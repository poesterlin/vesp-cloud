import { S3Client } from 'bun';

let s3: S3Client | null = null;

export function ensureS3(): S3Client {
  if (s3) return s3;
  const endpoint = process.env.MINIO_ENDPOINT;
  const bucket = process.env.MINIO_BUCKET;
  if (!endpoint || !bucket) throw new Error('Feedback attachment storage is not configured');

  s3 = new S3Client({
    endpoint,
    bucket,
    region: 'us-east-1',
    accessKeyId: process.env.MINIO_ACCESS_KEY,
    secretAccessKey: process.env.MINIO_SECRET_KEY,
  });
  return s3;
}

export async function getBinarySize(jobId: string): Promise<number | null> {
  try {
    const client = ensureS3();
    const file = client.file(`builds/${jobId}.bin`);
    const stat = await file.stat();
    return stat.size;
  } catch {
    return null;
  }
}
