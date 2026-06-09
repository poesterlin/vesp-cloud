import { building } from "$app/environment";
import { env } from "$env/dynamic/private";
import { S3Client } from "bun";

let s3: S3Client | null = null;

if (!building) {
  s3 = new S3Client({
    endpoint: env.MINIO_ENDPOINT,
    accessKeyId: env.MINIO_ACCESS_KEY,
    secretAccessKey: env.MINIO_SECRET_KEY,
    region: "us-east-1",
    bucket: env.MINIO_BUCKET,
  });
}

function binKey(jobId: string): string {
  return `builds/${jobId}.bin`;
}

export async function uploadBinary(jobId: string, data: Buffer): Promise<void> {
  if (!s3) throw new Error("S3 client not initialized");
  await s3.write(binKey(jobId), data, { type: "application/octet-stream" });
}

export async function getBinaryStream(jobId: string): Promise<Response> {
  if (!s3) throw new Error("S3 client not initialized");
  const file = s3.file(binKey(jobId));
  return new Response(file.stream(), {
    headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" },
  });
}

export async function getBinaryBuffer(jobId: string): Promise<Response> {
  if (!s3) throw new Error("S3 client not initialized");
  const file = s3.file(binKey(jobId));
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
  if (!s3) return;
  try { await s3.delete(binKey(jobId)); } catch {}
}

export async function deleteBinaries(jobIds: string[]): Promise<void> {
  if (!s3) return;
  for (const id of jobIds) await deleteBinary(id);
}

export async function binaryExists(jobId: string): Promise<boolean> {
  if (!s3) return false;
  try {
    const file = s3.file(binKey(jobId));
    await file.arrayBuffer();
    return true;
  } catch {
    return false;
  }
}
