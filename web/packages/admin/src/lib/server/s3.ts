import { building } from "$app/environment";
import { env } from "$env/dynamic/private";
import { S3Client } from "bun";

let s3: S3Client | null = null;

function ensureS3(): S3Client {
  if (s3) return s3;
  if (building) throw new Error("S3 client not available during build");

  const endpoint = env.MINIO_ENDPOINT;
  const bucket = env.MINIO_BUCKET;

  if (!endpoint || !bucket) {
    throw new Error(
      `S3 not configured: MINIO_ENDPOINT=${endpoint || "missing"}, MINIO_BUCKET=${bucket || "missing"}`,
    );
  }

  s3 = new S3Client({
    endpoint,
    accessKeyId: env.MINIO_ACCESS_KEY,
    secretAccessKey: env.MINIO_SECRET_KEY,
    region: "us-east-1",
    bucket,
  });
  return s3;
}

const SCREENSHOT_PREFIX = "screenshots";

function screenshotKey(deviceId: string, timestamp: number): string {
  return `${SCREENSHOT_PREFIX}/${deviceId}/${timestamp}.bin`;
}

function screenshotIndexKey(): string {
  return `${SCREENSHOT_PREFIX}/_index.json`;
}

export async function getScreenshotBuffer(
  deviceId: string,
  timestamp?: number,
): Promise<Buffer | null> {
  const client = ensureS3();
  let ts = timestamp;
  if (ts == null) {
    const indexFile = client.file(screenshotIndexKey());
    try {
      if (await indexFile.exists()) {
        const buf = Buffer.from(await indexFile.arrayBuffer());
        const index = JSON.parse(buf.toString()) as Record<
          string,
          Array<{ ts: number; size: number }>
        >;
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
    const index = JSON.parse(buf.toString()) as Record<
      string,
      Array<{ ts: number; size: number }>
    >;
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
