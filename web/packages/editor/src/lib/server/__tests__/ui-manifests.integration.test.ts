import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '@vesp-cloud/db';
import { usersTable, projects, compilationJobs, uiFirmwareBuilds, uiManifestReleases } from '@vesp-cloud/db/schema';
import type { Project } from '@vesp-cloud/schema';
import { RETRO_THEME } from '../../themes/retro';
import { compileUiManifest } from '../../codegen/ui-manifest';
import { uiFirmwareCapabilities, uiManifestRequirements } from '../../codegen/ui-capabilities';
import { loadUiDeployment, publishUiLayout, manifestArtifact } from '../ui-manifests';
import { GET as download } from '../../../routes/(public)/api/firmware/[token]/ui-manifest/+server';
import { POST as report } from '../../../routes/(public)/api/firmware/[token]/ui-status/+server';
import { GET as ownerStatus } from '../../../routes/api/projects/[id]/ui-manifest/+server';
import { POST as publishFirmware } from '../../../routes/api/compile/[jobId]/publish/+server';

const testDatabase = process.env.UI_MANIFEST_TEST_DATABASE_URL;

test.skipIf(!testDatabase)('cloud publication, capability negotiation and boot reporting are isolated and transactional', async () => {
  const db = getDb(testDatabase);
  const owner = `manifest-test-${randomUUID()}`;
  const stranger = `manifest-test-${randomUUID()}`;
  const config: Project = { name: 'Manifest integration', display: { width: 480, height: 480 }, theme: RETRO_THEME,
    notificationOverlay: { enabled: false }, dashboardPages: [{ id: 'home', name: 'Home', components: [
      { id: 'title', type: 'text', text: 'Before', position: { x: 20, y: 20 }, size: { width: 200, height: 40 } },
      { id: 'icon', type: 'icon', icon: 'power', position: { x: 20, y: 80 }, size: { width: 40, height: 40 } },
    ] }], detailViews: [] };
  const artifactFor = (project: Project) => {
    const compiled = compileUiManifest(project);
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.errors));
    return manifestArtifact(compiled.bytes, uiManifestRequirements(project));
  };
  const rejectStatus = async (action: unknown, status: number) => {
    try { await action; throw new Error(`Expected HTTP ${status}`); } catch (error) {
      expect((error as { status?: number }).status).toBe(status);
    }
  };
  try {
    await db.insert(usersTable).values([owner, stranger].map(id => ({ id, username: id, passwordHash: 'test-only', createdAt: new Date() })));
    const [project] = await db.insert(projects).values({ userId: owner, name: config.name, data: config }).returning();
    const [other] = await db.insert(projects).values({ userId: stranger, name: config.name, data: config }).returning();
    const [job] = await db.insert(compilationJobs).values({ projectId: project.id, userId: owner,
      projectName: config.name, config: JSON.stringify(config), status: 'completed', published: true, completedAt: new Date() }).returning();
    const initial = artifactFor(config);
    await db.insert(uiFirmwareBuilds).values({ id: job.id, jobId: job.id, projectId: project.id, available: true,
      capabilities: uiFirmwareCapabilities(config), manifestBase64: initial.manifestBase64, sha256: initial.sha256, fingerprint: initial.fingerprint });
    const get = (token = project.firmwareToken, build = job.id) => download({ params: { token }, url: new URL(`http://device/ui-manifest?build=${build}`) } as never);
    const boot = (fingerprint: string, source = 'embedded', buildId = job.id) => report({ params: { token: project.firmwareToken },
      request: new Request('http://device/ui-status', { method: 'POST', body: JSON.stringify({ deviceId: 'AABBCCDDEEFF', buildId, fingerprint, source }) }) } as never);

    expect((await loadUiDeployment(project.id)).installationConfirmed).toBe(false);
    await rejectStatus(get(), 404);
    await rejectStatus(publishUiLayout(project.id, stranger), 404);
    await rejectStatus(ownerStatus({ locals: {}, params: { id: project.id } } as never), 401);
    await rejectStatus(ownerStatus({ locals: { user: { id: stranger } }, params: { id: project.id } } as never), 404);
    const first = await publishUiLayout(project.id, owner);
    expect(first.revision).toBe(1);
    const repeated = await Promise.all([publishUiLayout(project.id, owner), publishUiLayout(project.id, owner)]);
    expect(repeated.map(value => value.revision)).toEqual([1, 1]);

    const edited = structuredClone(config);
    if (edited.dashboardPages[0].components[0].type === 'text') edited.dashboardPages[0].components[0].text = 'After';
    await db.update(projects).set({ data: edited }).where(eq(projects.id, project.id));
    const next = await Promise.all([publishUiLayout(project.id, owner), publishUiLayout(project.id, owner)]);
    expect(next.map(value => value.revision)).toEqual([2, 2]);
    const served = await get();
    expect(served.headers.get('x-vespui-revision')).toBe('2');
    expect(served.headers.get('cache-control')).toBe('no-store');
    expect(Buffer.from(await served.arrayBuffer()).toString('base64')).toBe(artifactFor(edited).manifestBase64);
    await boot(first.fingerprint);
    let status = await loadUiDeployment(project.id);
    expect(status.installationConfirmed).toBe(true);
    expect(status.published?.revision).toBe(2);
    expect(status.devices[0].activeRevision).toBe(1);
    await boot(next[0].fingerprint, 'cache');
    status = await loadUiDeployment(project.id);
    expect(status.devices[0].activeRevision).toBe(2);
    expect(status.devices[0].source).toBe('cache');

    const upgraded = structuredClone(edited);
    if (upgraded.dashboardPages[0].components[1].type === 'icon') upgraded.dashboardPages[0].components[1].icon = 'lightbulb';
    await db.update(projects).set({ data: upgraded }).where(eq(projects.id, project.id));
    await rejectStatus(publishUiLayout(project.id, owner), 409);
    expect((await loadUiDeployment(project.id)).published?.revision).toBe(2);
    const [newJob] = await db.insert(compilationJobs).values({ projectId: project.id, userId: owner,
      projectName: config.name, config: JSON.stringify(upgraded), status: 'completed', completedAt: new Date() }).returning();
    const upgradeArtifact = artifactFor(upgraded);
    await db.insert(uiFirmwareBuilds).values({ id: newJob.id, jobId: newJob.id, projectId: project.id, available: true,
      capabilities: uiFirmwareCapabilities(upgraded), manifestBase64: upgradeArtifact.manifestBase64,
      sha256: upgradeArtifact.sha256, fingerprint: upgradeArtifact.fingerprint });
    await publishFirmware({ locals: { user: { id: owner } }, params: { jobId: newJob.id } } as never);
    expect((await loadUiDeployment(project.id)).published?.revision).toBe(3);
    expect((await loadUiDeployment(project.id)).devices[0].canLoadPublished).toBe(false);
    await rejectStatus(get(), 409); // Old firmware must keep its cache/embedded UI.
    await boot(upgradeArtifact.fingerprint, 'embedded', newJob.id);
    expect((await loadUiDeployment(project.id)).devices[0].activeRevision).toBe(3);
    expect((await publishUiLayout(project.id, owner)).revision).toBe(3);
    expect((await get(project.firmwareToken, newJob.id)).status).toBe(200);
    await rejectStatus(get(other.firmwareToken, newJob.id), 404);
    await rejectStatus(get(randomUUID(), newJob.id), 404);
    await rejectStatus(report({ params: { token: project.firmwareToken }, request: new Request('http://device', {
      method: 'POST', body: JSON.stringify({ deviceId: 'device', buildId: newJob.id, fingerprint: 'bad', source: 'download' }),
    }) } as never), 400);
    await rejectStatus(report({ params: { token: project.firmwareToken }, request: new Request('http://device', {
      method: 'POST', body: 'x'.repeat(4097),
    }) } as never), 413);
    // Deleting build history must not lose resources of already installed firmware.
    await db.delete(compilationJobs).where(eq(compilationJobs.id, newJob.id));
    expect((await get(project.firmwareToken, newJob.id)).status).toBe(200);
    expect((await loadUiDeployment(project.id)).ready).toBe(true);
    await db.update(projects).set({ firmwareToken: randomUUID() }).where(eq(projects.id, project.id));
    await rejectStatus(get(project.firmwareToken, newJob.id), 404);
    expect((await db.select().from(uiManifestReleases).where(eq(uiManifestReleases.projectId, project.id))).length).toBe(3);
  } finally {
    await db.delete(usersTable).where(eq(usersTable.id, owner));
    await db.delete(usersTable).where(eq(usersTable.id, stranger));
    await db.$client.end();
  }
}, 30_000);
