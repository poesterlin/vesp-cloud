import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(connectionString?: string) {
  if (!db) {
    const url = connectionString || process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set. Pass a connection string or set the DATABASE_URL environment variable.');
    }
    db = drizzle(url, { schema });
  }
  return db;
}

export { schema };
