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

const SCREENCAP_PREFIX = "screencaps";
const SCREENCAP_LIST = `${SCREENCAP_PREFIX}/_list.txt`;

async function readList(): Promise<string[]> {
  const client = ensureS3();
  try {
    const file = client.file(SCREENCAP_LIST);
    if (!(await file.exists())) return [];
    const text = Buffer.from(await file.arrayBuffer()).toString("utf-8").trim();
    return text ? text.split("\n") : [];
  } catch {
    return [];
  }
}

export async function listScreenshots(): Promise<string[]> {
  return (await readList()).reverse();
}

export async function getScreenshotBuffer(name: string): Promise<Buffer | null> {
  const client = ensureS3();
  const file = client.file(`${SCREENCAP_PREFIX}/${name}`);
  if (!(await file.exists())) return null;
  return Buffer.from(await file.arrayBuffer());
}
