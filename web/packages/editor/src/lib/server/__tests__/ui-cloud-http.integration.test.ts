import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import JSZip from 'jszip';
import { getDb } from '@vesp-cloud/db';
import { usersTable, projects, compilationJobs, uiFirmwareBuilds } from '@vesp-cloud/db/schema';
import { createSession, generateSessionToken } from '../auth';
import { manifestFingerprint } from '../../codegen/ui-capabilities';
import { RETRO_THEME } from '../../themes/retro';

const database = process.env.UI_MANIFEST_TEST_DATABASE_URL;
const origin = process.env.UI_MANIFEST_HTTP_TEST_URL;

test.skipIf(!database || !origin)('hosted source export and layout publishing deliver bytes and confirm only reported boots', async () => {
  const db = getDb(database);
  const userId = `ui-http-${randomUUID()}`;
  try {
    await db.insert(usersTable).values({ id: userId, username: userId, passwordHash: 'test-only', createdAt: new Date() });
    const config = { name: 'HTTP manifest test', display: { width: 480, height: 480 }, theme: RETRO_THEME,
      dashboardPages: [{ id: 'home', name: 'Home', components: [
        { id: 'label', type: 'text', text: 'Before', position: { x: 20, y: 20 }, size: { width: 200, height: 40 } },
      ] }], detailViews: [] };
    const [project] = await db.insert(projects).values({ userId, name: config.name, data: config }).returning();
    const token = generateSessionToken(); await createSession(token, userId);
    const request = (path: string, method = 'GET', data?: unknown, headers: Record<string, string> = {}) => fetch(`${origin}${path}`, {
      method, headers: { Cookie: `auth-session=${token}`, Accept: 'application/json',
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    const status = async () => (await request(`/api/projects/${project.id}/ui-manifest`)).json();
    expect((await status()).ready).toBe(false);
    const source = await request(`/api/projects/${project.id}/firmware-export`, 'POST');
    expect(source.status).toBe(200);
    const zip = await JSZip.loadAsync(await source.arrayBuffer());
    expect(zip.file('includes/ui_manifest_storage.h')).not.toBeNull();
    expect(zip.file('base.yaml')).not.toBeNull();
    const manifest = await zip.file('ui_manifest.vespui')!.async('uint8array');
    const secrets = await zip.file('secrets.yaml')!.async('string');
    const downloadUrl = secrets.match(/ui_manifest_url: "([^"]+)"/)?.[1];
    const reportUrl = secrets.match(/ui_manifest_report_url: "([^"]+)"/)?.[1];
    expect(downloadUrl).toContain(`/api/firmware/${project.firmwareToken}/ui-manifest?build=`);
    expect(reportUrl).toContain(`/api/firmware/${project.firmwareToken}/ui-status`);
    const [build] = await db.select().from(uiFirmwareBuilds).where(eq(uiFirmwareBuilds.projectId, project.id));
    expect(build.sourceExport).toBe(true);
    const yaml = await zip.file('http-manifest-test.yaml')!.async('string');
    expect(yaml).toContain(`root["buildId"] = "${build.id}";`);
    expect(yaml).toContain('url: !secret ui_manifest_url');
    expect((await status()).installationConfirmed).toBe(false);
    let response = await request(`/api/projects/${project.id}/ui-manifest`, 'POST');
    expect(response.status).toBe(200);
    expect((await response.json()).revision).toBe(1);
    expect((await db.select().from(compilationJobs).where(eq(compilationJobs.projectId, project.id))).length).toBe(0);
    const downloaded = await fetch(downloadUrl!);
    expect(downloaded.status).toBe(200);
    expect([...new Uint8Array(await downloaded.arrayBuffer())]).toEqual([...manifest]);
    expect((await status()).installationConfirmed).toBe(false); // A GET is not installation evidence.
    const unknown = await fetch(`${origin}/api/firmware/${randomUUID()}/ui-manifest?build=${build.id}`);
    expect(unknown.status).toBe(404);
    expect(unknown.headers.get('cache-control')).toBe('no-store');
    const report = (fingerprint: string, source: string) => fetch(reportUrl!, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'HTTP_TEST_DEVICE', buildId: build.id, fingerprint, source }) });
    expect((await report(manifestFingerprint(manifest), 'embedded')).status).toBe(200);
    expect((await status()).devices[0].activeRevision).toBe(1);
    config.dashboardPages[0].components[0].text = 'After';
    expect((await request(`/api/projects/${project.id}`, 'PUT', { data: config, name: config.name })).status).toBe(200);
    response = await request(`/api/projects/${project.id}/ui-manifest`, 'POST');
    expect((await response.json()).revision).toBe(2);
    const updated = await fetch(downloadUrl!);
    const updatedBytes = new Uint8Array(await updated.arrayBuffer());
    expect(updated.headers.get('x-vespui-revision')).toBe('2');
    let deployment = await status();
    expect(deployment.published.revision).toBe(2);
    expect(deployment.devices[0].activeRevision).toBe(1);
    expect((await report(manifestFingerprint(updatedBytes), 'download')).status).toBe(200);
    deployment = await status();
    expect(deployment.devices[0].activeRevision).toBe(2);
    const page = await request(`/project/${project.id}/deploy`, 'GET', undefined, { Accept: 'text/html' });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('Manifest-enabled firmware');
    expect(html).toContain('Revision 2 active');
    expect((await request(`/api/projects/${project.id}/ui-manifest`, 'POST', undefined, { Origin: 'https://other.invalid' })).status).toBe(403);
    expect((await fetch(`${origin}/api/projects/${project.id}/ui-manifest`, { method: 'POST', headers: { Accept: 'application/json' } })).status).toBe(401);
    for (const jobStatus of ['pending', 'failed']) {
      const [job] = await db.insert(compilationJobs).values({ projectId: project.id, userId,
        projectName: config.name, config: JSON.stringify(config), status: jobStatus }).returning();
      const response = await request(`/api/compile/${job.id}/download`);
      expect(response.status).toBe(200);
      const jobZip = await JSZip.loadAsync(await response.arrayBuffer());
      const jobSecrets = await jobZip.file('secrets.yaml')!.async('string');
      const sourceUrl = jobSecrets.match(/ui_manifest_url: "([^"]+)"/)![1];
      const identity = new URL(sourceUrl).searchParams.get('build')!;
      expect(identity).not.toBe(job.id);
      const [registered] = await db.select().from(uiFirmwareBuilds).where(eq(uiFirmwareBuilds.id, identity));
      expect(registered.available).toBe(true);
      expect(registered.sourceExport).toBe(true);
      expect((await fetch(sourceUrl)).status).toBe(200);
    }
    const devicePath = `/api/projects/${project.id}/ui-devices/HTTP_TEST_DEVICE`;
    expect((await fetch(`${origin}${devicePath}`, { method: 'DELETE', headers: { Accept: 'application/json' } })).status).toBe(401);
    const otherId = `other-${randomUUID()}`;
    await db.insert(usersTable).values({ id: otherId, username: otherId, passwordHash: 'test-only', createdAt: new Date() });
    try {
      const otherToken = generateSessionToken(); await createSession(otherToken, otherId);
      expect((await request(devicePath, 'DELETE', undefined, { Cookie: `auth-session=${otherToken}` })).status).toBe(404);
      expect((await status()).devices.length).toBe(1);
    } finally { await db.delete(usersTable).where(eq(usersTable.id, otherId)); }
    expect((await request(devicePath, 'DELETE')).status).toBe(200);
    expect((await status()).devices.length).toBe(0);
    expect((await report(manifestFingerprint(updatedBytes), 'cache')).status).toBe(200);
    expect((await status()).devices.length).toBe(1);
  } finally {
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    await db.$client.end();
  }
}, 30_000);
