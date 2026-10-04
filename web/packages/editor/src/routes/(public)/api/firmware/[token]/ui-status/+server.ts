import { error, json } from '@sveltejs/kit';
import { getDb } from '@vesp-cloud/db';
import { uiDeviceBoots } from '@vesp-cloud/db/schema';
import { resolveUiDevice } from '$lib/server/ui-manifests';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
  const reader = request.body?.getReader();
  if (!reader) error(400, 'Boot report required');
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4096) { await reader.cancel(); error(413, 'Boot report too large'); }
    parts.push(value);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { error(400, 'Invalid JSON'); }
  if (!body || typeof body !== 'object' || typeof body.deviceId !== 'string' ||
      !/^[a-zA-Z0-9:_-]{1,64}$/.test(body.deviceId) || typeof body.fingerprint !== 'string' ||
      !/^[0-9a-f]{16}$/.test(body.fingerprint) || !['download', 'cache', 'embedded'].includes(body.source) ||
      (body.error !== undefined && (typeof body.error !== 'string' || body.error.length > 512))) error(400, 'Invalid boot report');
  const device = await resolveUiDevice(params.token, typeof body.buildId === 'string' ? body.buildId : null);
  const report = { projectId: device.projectId, deviceId: body.deviceId, firmwareBuildId: device.buildId,
    fingerprint: body.fingerprint, source: body.source, error: body.error || null, reportedAt: new Date() };
  await getDb().insert(uiDeviceBoots).values(report).onConflictDoUpdate({
    target: [uiDeviceBoots.projectId, uiDeviceBoots.deviceId], set: report,
  });
  return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
};
