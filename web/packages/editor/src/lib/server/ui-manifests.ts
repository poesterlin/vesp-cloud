import { createHash } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '@vesp-cloud/db';
import { compilationJobs, projects, uiDeviceBoots, uiFirmwareBuilds, uiManifestReleases } from '@vesp-cloud/db/schema';
import type { Project } from '@vesp-cloud/schema';
import { compileUiManifest } from '../codegen/ui-manifest';
import { manifestFingerprint, uiCompatibilityReasons, uiManifestRequirements, type UiFirmwareCapabilities } from '../codegen/ui-capabilities';
import { validateProject } from '../codegen/validations';
import { validateProjectSchema } from './project-schema';

type Db = Pick<ReturnType<typeof getDb>, 'select' | 'insert' | 'update'>;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uiManifestUrls(origin: string, token: string, buildId?: string) {
  const base = `${origin.replace(/\/$/, '')}/api/firmware/${token}`;
  return {
    uiManifestUrl: `${base}/ui-manifest${buildId ? `?build=${encodeURIComponent(buildId)}` : ''}`,
    uiManifestReportUrl: `${base}/ui-status`,
  };
}

export function manifestArtifact(bytes: Uint8Array, requirements: UiFirmwareCapabilities) {
  return {
    manifestBase64: Buffer.from(bytes).toString('base64'),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    fingerprint: manifestFingerprint(bytes),
    requirements,
  };
}

// Call while holding the project's row lock, shared by layout and firmware publish.
export async function appendUiManifestRelease(db: Db, projectId: string, artifact: ReturnType<typeof manifestArtifact>) {
  const [latest] = await db.select().from(uiManifestReleases)
    .where(eq(uiManifestReleases.projectId, projectId)).orderBy(desc(uiManifestReleases.revision)).limit(1);
  const previous = latest?.requirements as UiFirmwareCapabilities | undefined;
  if (latest?.sha256 === artifact.sha256 && previous?.theme === artifact.requirements.theme &&
      previous?.formatVersion === artifact.requirements.formatVersion) return latest;
  const [release] = await db.insert(uiManifestReleases).values({ projectId, revision: (latest?.revision ?? 0) + 1, ...artifact }).returning();
  return release;
}

export async function loadUiDeployment(projectId: string, db: Db = getDb()) {
  const builds = await db.select({ id: uiFirmwareBuilds.id, jobId: uiFirmwareBuilds.jobId, sourceExport: uiFirmwareBuilds.sourceExport, capabilities: uiFirmwareBuilds.capabilities,
    published: compilationJobs.published, createdAt: uiFirmwareBuilds.createdAt })
    .from(uiFirmwareBuilds).leftJoin(compilationJobs, eq(compilationJobs.id, uiFirmwareBuilds.jobId))
    .where(and(eq(uiFirmwareBuilds.projectId, projectId), eq(uiFirmwareBuilds.available, true)))
    .orderBy(desc(uiFirmwareBuilds.createdAt));
  const reports = await db.select().from(uiDeviceBoots).where(eq(uiDeviceBoots.projectId, projectId));
  const releases = await db.select({ revision: uiManifestReleases.revision, sha256: uiManifestReleases.sha256,
    fingerprint: uiManifestReleases.fingerprint, requirements: uiManifestReleases.requirements, createdAt: uiManifestReleases.createdAt })
    .from(uiManifestReleases).where(eq(uiManifestReleases.projectId, projectId)).orderBy(desc(uiManifestReleases.revision));
  const buildById = new Map(builds.map(build => [build.id, build]));
  const targetBuilds = reports.length
    ? builds.filter(build => reports.some(report => report.firmwareBuildId === build.id))
    : builds.filter(build => build.published || build.sourceExport).slice(0, 1);
  const unknownDevices = reports.filter(report => !report.firmwareBuildId || !buildById.has(report.firmwareBuildId));
  return {
    ready: targetBuilds.length > 0 && unknownDevices.length === 0,
    installationConfirmed: reports.length > 0 && unknownDevices.length === 0,
    firmwareBuilds: targetBuilds.map(build => ({ id: build.id, capabilities: build.capabilities as UiFirmwareCapabilities })),
    published: releases[0] ? { revision: releases[0].revision, fingerprint: releases[0].fingerprint, createdAt: releases[0].createdAt } : null,
    devices: reports.map(report => {
      const build = report.firmwareBuildId ? buildById.get(report.firmwareBuildId) : undefined;
      const active = build ? releases.find(release => release.fingerprint === report.fingerprint &&
        uiCompatibilityReasons(release.requirements as UiFirmwareCapabilities, build.capabilities as UiFirmwareCapabilities).length === 0) : undefined;
      return { deviceId: report.deviceId, firmwareBuildId: report.firmwareBuildId, source: report.source,
        fingerprint: report.fingerprint, activeRevision: active?.revision ?? null,
        canLoadPublished: !!build && !!releases[0] && uiCompatibilityReasons(releases[0].requirements as UiFirmwareCapabilities,
          build.capabilities as UiFirmwareCapabilities).length === 0,
        reportedAt: report.reportedAt, error: report.error };
    }),
  };
}

export async function publishUiLayout(projectId: string, userId: string) {
  return getDb().transaction(async tx => {
    const [project] = await tx.select().from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId))).for('update');
    if (!project) error(404, 'Project not found');
    const config = project.data as Project;
    const schema = validateProjectSchema(config);
    if (!schema.valid) error(400, schema.errors.join('; '));
    const validation = validateProject(config);
    if (validation.length) error(400, validation.map(issue => issue.message).join('; '));
    const manifest = compileUiManifest(config);
    if (!manifest.ok) error(409, manifest.errors.map(issue => issue.message).join('; '));
    const deployment = await loadUiDeployment(projectId, tx);
    if (!deployment.ready) error(409, 'Install and publish manifest-enabled firmware before publishing a layout.');
    const requirements = uiManifestRequirements(config);
    const reasons = [...new Set(deployment.firmwareBuilds.flatMap(build => uiCompatibilityReasons(requirements, build.capabilities)))];
    if (reasons.length) error(409, `Firmware update required: ${reasons.join(' ')}`);
    const release = await appendUiManifestRelease(tx, projectId, manifestArtifact(manifest.bytes, requirements));
    return { revision: release.revision, fingerprint: release.fingerprint, createdAt: release.createdAt };
  });
}

export async function resolveUiDevice(token: string, buildId: string | null) {
  if (!UUID_PATTERN.test(token)) error(404, 'Not found');
  if (!buildId || !UUID_PATTERN.test(buildId)) error(400, 'A firmware build ID is required');
  const db = getDb();
  const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.firmwareToken, token));
  if (!project) error(404, 'Not found');
  const [build] = await db.select({ capabilities: uiFirmwareBuilds.capabilities, id: uiFirmwareBuilds.id })
    .from(uiFirmwareBuilds)
    .where(and(eq(uiFirmwareBuilds.projectId, project.id), eq(uiFirmwareBuilds.id, buildId),
      eq(uiFirmwareBuilds.available, true)));
  if (!build) error(404, 'Manifest-enabled firmware build not found');
  return { projectId: project.id, buildId: build.id, capabilities: build.capabilities as UiFirmwareCapabilities };
}
