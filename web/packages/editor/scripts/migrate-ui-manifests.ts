import { getDb } from '@vesp-cloud/db';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const db = getDb();
try {
  const sql = await Bun.file(new URL('../migrations/20261004-ui-manifests.sql', import.meta.url)).text();
  await db.$client.query(sql);
  console.log('UI manifest publishing schema is ready.');
} finally {
  await db.$client.end();
}
