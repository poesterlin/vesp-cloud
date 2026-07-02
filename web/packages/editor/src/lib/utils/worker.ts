import type { CompilationJob, NewCompilationJob } from '@esphome-designer/db/schema';
import { CompilationQueue } from '$lib/queue/index.js';
import { getDb, schema } from '@esphome-designer/db';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
export { getDb, schema };

interface CompilationResult {
  jobId: string | undefined;
  status: string;
}

let compilationQueue: CompilationQueue | null = null;

function getCompilerMode(): 'embedded' | 'external' {
  const mode = (process.env.COMPILER_MODE ?? 'embedded').toLowerCase();
  return mode === 'external' ? 'external' : 'embedded';
}

function isEmbeddedMode(): boolean {
  return getCompilerMode() === 'embedded';
}

async function hasUserActiveJobInDb(userId: string): Promise<boolean> {
  const db = getDb();
  const active = await db
    .select({ id: schema.compilationJobs.id })
    .from(schema.compilationJobs)
    .where(
      and(
        eq(schema.compilationJobs.userId, userId),
        inArray(schema.compilationJobs.status, ['pending', 'running', 'queued']),
      ),
    )
    .limit(1);

  return active.length > 0;
}

export function startWorker(maxWorkers: number = 2): void {
  if (compilationQueue) {
    console.warn('Compilation queue already started');
    return;
  }
  
  compilationQueue = new CompilationQueue(maxWorkers);
  compilationQueue.start();
}

export function stopWorker(): Promise<void> {
  if (!compilationQueue) {
    return Promise.resolve();
  }
  
  const queue = compilationQueue;
  compilationQueue = null;
  return queue.stop();
}

export async function submitCompilationJob(
  projectId: string,
  projectName: string,
  config: string,
  configPath: string = '',
  userId?: string,
  template?: 'initial' | null
): Promise<CompilationResult> {
  const id = uuidv4();
  const job: NewCompilationJob & { id: string } = {
    id,
    projectId,
    projectName,
    config,
    configPath,
    template: template ?? null,
    status: 'pending',
    userId: userId ?? null,
    createdAt: new Date()
  };

  if (job.userId) {
    const hasActive = await hasUserActiveJobInDb(job.userId);
    if (hasActive) {
      throw new Error('You already have an active compilation job. Please wait for it to finish.');
    }
  }

  if (compilationQueue) {
    await compilationQueue.addJob(job);
  } else {
    const db = getDb();
    await db.insert(schema.compilationJobs).values(job);

    if (isEmbeddedMode()) {
      console.warn('Compilation queue unavailable in embedded mode; job stored in DB as pending');
    }
  }

  return {
    jobId: job.id,
    status: 'pending'
  };
}

export async function getJobStatus(jobId: string): Promise<CompilationJob | undefined> {
  const db = getDb();
  const jobs = await db
    .select()
    .from(schema.compilationJobs)
    .where(eq(schema.compilationJobs.id, jobId))
    .limit(1);

  return jobs[0];
}

export async function getAllJobs(): Promise<CompilationJob[]> {
  const db = getDb();
  return db.select().from(schema.compilationJobs).orderBy(desc(schema.compilationJobs.createdAt));
}

export async function getProjectJobs(
  projectId: string,
  limit = 10,
): Promise<CompilationJob[]> {
  const db = getDb();
  return db
    .select()
    .from(schema.compilationJobs)
    .where(eq(schema.compilationJobs.projectId, projectId))
    .orderBy(desc(schema.compilationJobs.createdAt))
    .limit(limit);
}

export async function getQueueStats() {
  const db = getDb();
  const jobs = await db.select({ status: schema.compilationJobs.status }).from(schema.compilationJobs);

  const stats = {
    total: jobs.length,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
  };

  for (const job of jobs) {
    switch (job.status) {
      case 'pending':
      case 'queued':
        stats.pending++;
        break;
      case 'running':
        stats.running++;
        break;
      case 'completed':
        stats.completed++;
        break;
      case 'failed':
        stats.failed++;
        break;
    }
  }

  return stats;
}
