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

function screenshotKey(deviceId: string): string {
  return `${SCREENSHOT_PREFIX}/${deviceId}.bin`;
}

function screenshotIndexKey(): string {
  return `${SCREENSHOT_PREFIX}/_index.json`;
}

export async function getScreenshotBuffer(deviceId: string): Promise<Buffer | null> {
  const client = ensureS3();
  const file = client.file(screenshotKey(deviceId));
  if (!(await file.exists())) return null;
  return Buffer.from(await file.arrayBuffer());
}

export async function listScreenshotDevices(): Promise<
  Array<{ deviceId: string; size: number; mtime: number }>
> {
  const client = ensureS3();
  try {
    const indexFile = client.file(screenshotIndexKey());
    if (!(await indexFile.exists())) return [];
    const buf = Buffer.from(await indexFile.arrayBuffer());
    const index = JSON.parse(buf.toString()) as Record<
      string,
      { size: number; mtime: number }
    >;
    return Object.entries(index).map(([deviceId, meta]) => ({
      deviceId,
      size: meta.size ?? 0,
      mtime: meta.mtime ?? 0,
    }));
  } catch {
    return [];
  }
}
