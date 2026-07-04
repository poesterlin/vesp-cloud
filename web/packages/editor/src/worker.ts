import { getDb } from '@vesp-cloud/db';
import { startWorker, stopWorker } from './lib/utils/worker';

const databaseUrl = process.env.DATABASE_URL;
const concurrentJobs = Number.parseInt(process.env.CONCURRENT_JOBS || '2', 10);

async function main(): Promise<void> {
  console.log('Initializing database for worker...');
  getDb(databaseUrl);
  console.log('Database ready');

  startWorker(Number.isNaN(concurrentJobs) ? 2 : concurrentJobs);
  console.log('Worker started (standalone mode)');
}

void main().catch(async (error) => {
  console.error('Failed to start worker:', error);
  await stopWorker();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received');
  await stopWorker();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received');
  await stopWorker();
  process.exit(0);
});
