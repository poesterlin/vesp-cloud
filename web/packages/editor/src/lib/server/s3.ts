import { S3Client } from "bun";

let s3: S3Client | null = null;

export function ensureS3(): S3Client {
  if (s3) return s3;

  const endpoint = process.env.MINIO_ENDPOINT;
  const bucket = process.env.MINIO_BUCKET;

  if (!endpoint || !bucket) {
    throw new Error(
      `S3 not configured: MINIO_ENDPOINT=${endpoint || "missing"}, MINIO_BUCKET=${bucket || "missing"}`,
    );
  }

  s3 = new S3Client({
    endpoint,
    accessKeyId: process.env.MINIO_ACCESS_KEY,
    secretAccessKey: process.env.MINIO_SECRET_KEY,
    region: "us-east-1",
    bucket,
  });
  return s3;
}

export function binKey(jobId: string): string {
  return `builds/${jobId}.bin`;
}

export function factoryBinKey(jobId: string): string {
  return binKey(jobId);
}

export function otaBinKey(jobId: string): string {
  return `builds/${jobId}.ota.bin`;
}

export async function uploadBinary(jobId: string, data: Buffer): Promise<void> {
  const client = ensureS3();
  await client.write(binKey(jobId), data, { type: "application/octet-stream" });
}

export async function uploadFactoryBinary(jobId: string, data: Buffer): Promise<void> {
  const client = ensureS3();
  await client.write(factoryBinKey(jobId), data, { type: "application/octet-stream" });
}

export async function uploadOtaBinary(jobId: string, data: Buffer): Promise<void> {
  const client = ensureS3();
  await client.write(otaBinKey(jobId), data, { type: "application/octet-stream" });
}

export async function getBinaryStream(jobId: string): Promise<Response> {
  const client = ensureS3();
  const file = client.file(binKey(jobId));
  return new Response(file.stream(), {
    headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" },
  });
}

export async function getBinaryBuffer(jobId: string): Promise<Response> {
  const client = ensureS3();
  const file = client.file(binKey(jobId));
  const buffer = await file.arrayBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}

export async function deleteBinary(jobId: string): Promise<void> {
  try {
    const client = ensureS3();
    await client.delete(binKey(jobId));
    await client.delete(otaBinKey(jobId));
  } catch {}
}

export async function deleteFactoryBinary(jobId: string): Promise<void> {
  try {
    const client = ensureS3();
    await client.delete(factoryBinKey(jobId));
  } catch {}
}

export async function deleteBinaries(jobIds: string[]): Promise<void> {
  for (const id of jobIds) {
    await deleteBinary(id);
  }
}

export async function binaryExists(jobId: string): Promise<boolean> {
  try {
    const client = ensureS3();
    return await client.file(binKey(jobId)).exists();
  } catch {
    return false;
  }
}

export async function getBinaryStats(jobId: string): Promise<{ size: number; md5: string }> {
  const client = ensureS3();
  const file = client.file(binKey(jobId));
  const buffer = Buffer.from(await file.arrayBuffer());
  const { createHash } = await import('crypto');
  const md5 = createHash('md5').update(buffer).digest('hex');
  return { size: buffer.byteLength, md5 };
}

export async function otaBinaryExists(jobId: string): Promise<boolean> {
  try {
    const client = ensureS3();
    return await client.file(otaBinKey(jobId)).exists();
  } catch {
    return false;
  }
}

export async function getOtaBinaryStats(jobId: string): Promise<{ size: number; md5: string }> {
  const client = ensureS3();
  const file = client.file(otaBinKey(jobId));
  const buffer = Buffer.from(await file.arrayBuffer());
  const { createHash } = await import('crypto');
  const md5 = createHash('md5').update(buffer).digest('hex');
  return { size: buffer.byteLength, md5 };
}

export async function streamFirmware(jobId: string, headers: Record<string, string> = {}): Promise<Response> {
  const client = ensureS3();
  const file = client.file(binKey(jobId));
  return new Response(file.stream(), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

// ---- Screenshot debug storage -----------------------------------------------
const SCREENSHOT_PREFIX = "screenshots";

function screenshotKey(deviceId: string, timestamp: number): string {
  return `${SCREENSHOT_PREFIX}/${deviceId}/${timestamp}.bin`;
}

function screenshotIndexKey(): string {
  return `${SCREENSHOT_PREFIX}/_index.json`;
}

export async function uploadScreenshot(deviceId: string, data: Buffer): Promise<number> {
  const client = ensureS3();
  const ts = Date.now();
  await client.write(screenshotKey(deviceId, ts), data, { type: "application/octet-stream" });

  try {
    const indexFile = client.file(screenshotIndexKey());
    let index: Record<string, Array<{ ts: number; size: number }>> = {};
    try {
      const buf = Buffer.from(await indexFile.arrayBuffer());
      index = JSON.parse(buf.toString());
    } catch {}
    const entries = index[deviceId] ?? [];
    entries.unshift({ ts, size: data.length });
    index[deviceId] = entries;
    await client.write(screenshotIndexKey(), JSON.stringify(index), { type: "application/json" });
  } catch (e) {
    console.error("Failed to update screenshot index:", e);
  }
  return ts;
}

export async function getScreenshotBuffer(deviceId: string, timestamp?: number): Promise<Buffer | null> {
  const client = ensureS3();
  let ts = timestamp;
  if (ts == null) {
    const indexFile = client.file(screenshotIndexKey());
    try {
      if (await indexFile.exists()) {
        const buf = Buffer.from(await indexFile.arrayBuffer());
        const index = JSON.parse(buf.toString()) as Record<string, Array<{ ts: number; size: number }>>;
        const entries = index[deviceId];
        if (entries && entries.length > 0) ts = entries[0].ts;
      }
    } catch {}
  }
  if (ts == null) return null;
  const file = client.file(screenshotKey(deviceId, ts));
  if (!(await file.exists())) return null;
  return Buffer.from(await file.arrayBuffer());
}

export async function listScreenshotDevices(): Promise<
  Array<{ deviceId: string; ts: number; size: number }>
> {
  const client = ensureS3();
  try {
    const indexFile = client.file(screenshotIndexKey());
    if (!(await indexFile.exists())) return [];
    const buf = Buffer.from(await indexFile.arrayBuffer());
    const index = JSON.parse(buf.toString()) as Record<string, Array<{ ts: number; size: number }>>;
    const result: Array<{ deviceId: string; ts: number; size: number }> = [];
    for (const [deviceId, entries] of Object.entries(index)) {
      for (const e of entries) {
        result.push({ deviceId, ts: e.ts, size: e.size });
      }
    }
    return result;
  } catch {
    return [];
  }
}
