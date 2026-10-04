import { error } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '@vesp-cloud/db';
import { uiManifestReleases } from '@vesp-cloud/db/schema';
import { resolveUiDevice } from '$lib/server/ui-manifests';
import { uiCompatibilityReasons, type UiFirmwareCapabilities } from '$lib/codegen/ui-capabilities';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
  const device = await resolveUiDevice(params.token, url.searchParams.get('build'));
  const [release] = await getDb().select().from(uiManifestReleases)
    .where(eq(uiManifestReleases.projectId, device.projectId)).orderBy(desc(uiManifestReleases.revision)).limit(1);
  if (!release) error(404, 'No published layout');
  const reasons = uiCompatibilityReasons(release.requirements as UiFirmwareCapabilities, device.capabilities);
  if (reasons.length) error(409, `Firmware update required: ${reasons.join(' ')}`);
  const bytes = Buffer.from(release.manifestBase64, 'base64');
  return new Response(bytes, { headers: {
    'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes.length),
    'ETag': `"${release.sha256}"`, 'X-Vespui-Revision': String(release.revision), 'Cache-Control': 'no-store',
  } });
};
