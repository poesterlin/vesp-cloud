import type { CompilationJob, NewCompilationJob } from '$lib/db/schema';
import { CompilationQueue } from '$lib/queue/index.js';
import { v4 as uuidv4 } from 'uuid';
export { getDb, schema } from '$lib/db/index.js';

interface CompilationResult {
  jobId: string | undefined;
  status: string;
}

let compilationQueue: CompilationQueue | null = null;

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
  if (!compilationQueue) {
    throw new Error('Compilation queue not started');
  }

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
  
  compilationQueue.addJob(job);
  
  return {
    jobId: job.id,
    status: 'pending'
  };
}

export async function getJobStatus(jobId: string): Promise<CompilationJob | undefined> {
  if (!compilationQueue) {
    throw new Error('Compilation queue not started');
  }
  
  return compilationQueue.getJob(jobId);
}

export async function getAllJobs(): Promise<CompilationJob[]> {
  if (!compilationQueue) {
    throw new Error('Compilation queue not started');
  }

  return compilationQueue.getAllJobs();
}

export async function getProjectJobs(
  projectId: string,
  limit = 10,
): Promise<CompilationJob[]> {
  if (!compilationQueue) {
    throw new Error('Compilation queue not started');
  }

  return compilationQueue.getProjectJobs(projectId, limit);
}

export function getQueueStats() {
  if (!compilationQueue) {
    throw new Error('Compilation queue not started');
  }
  
  return compilationQueue.getStats();
}