import { EventEmitter } from 'events';
import { spawn, type ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { getDb, schema } from '$lib/db/index.js';
import { eq, desc, inArray, and } from 'drizzle-orm';
import type { CompilationJob, NewCompilationJob } from '$lib/db/schema';
import { env } from '$env/dynamic/private';
import type { Project } from '@esphome-designer/schema';
import { generateESPHomeYAML, generateUITypesHeader, generateUIStateHeader, generateUIScreensHeader, generateFontsYAML } from '$lib/codegen/esphome';
import { generateSecretsYAML } from '$lib/codegen/secrets';
import { validateProject } from '$lib/codegen/validations';
import { copyStaticTemplates } from '$lib/server/esphome-templates';
import { uploadBinary, deleteBinaries } from '$lib/server/s3';
import { addCredits, CREDIT_COSTS } from '$lib/credits';
import { createLogger } from '$lib/server/logger';
import type { Logger } from '$lib/server/logger';

interface ActiveJob {
  job: CompilationJob;
  process: ChildProcess;
}

export class CompilationQueue extends EventEmitter {
  private activeJobs: Map<string, ActiveJob> = new Map();
  private queue: CompilationJob[] = [];
  private jobs: Map<string, CompilationJob> = new Map();
  private isStopped = false;
  private pythonSitePackages = '';
  private consecutiveFailures = 0;
  private circuitOpenAt: number | null = null;

  private static CIRCUIT_FAILURE_THRESHOLD = 5;
  private static CIRCUIT_RESET_MS = 5 * 60_000;

  constructor(private maxWorkers: number = 2) {
    super();
  }

  async start(): Promise<void> {
    console.log(`🚀 Starting compilation queue with ${this.maxWorkers} slots`);
    this.isStopped = false;
    await this.resolvePythonSitePackages();
    await this.failInProgressJobs();
    this.processQueue();
  }

  private async resolvePythonSitePackages(): Promise<void> {
    const venvPath = env.ESPHOME_VENV;
    if (!venvPath) return;
    try {
      const libDir = join(venvPath, 'lib');
      const entries = await fs.readdir(libDir);
      const pythonDir = entries.find((e) => e.startsWith('python'));
      if (pythonDir) {
        this.pythonSitePackages = join(libDir, pythonDir, 'site-packages');
        console.log(`Resolved Python site-packages: ${this.pythonSitePackages}`);
      }
    } catch {
      console.warn('Could not resolve Python site-packages, using fallback');
    }
  }

  async stop(): Promise<void> {
    console.log('⏹️  Stopping compilation queue');
    this.isStopped = true;

    const activeEntries = Array.from(this.activeJobs.entries());
    const shutdownTimeout = 5000;

    for (const [, { process }] of activeEntries) {
      process.kill('SIGTERM');
    }

    await Promise.race([
      new Promise<void>((resolve) => {
        const check = () => {
          if (this.activeJobs.size === 0) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        setTimeout(check, 100);
      }),
      new Promise<void>((resolve) => setTimeout(resolve, shutdownTimeout)),
    ]);

    for (const [, { process }] of activeEntries) {
      try {
        process.kill('SIGKILL');
      } catch {
        // process already exited
      }
    }

    if (this.activeJobs.size > 0) {
      const db = getDb();
      const orphanedIds = Array.from(this.activeJobs.keys());
      await db
        .update(schema.compilationJobs)
        .set({
          status: 'failed',
          error: 'Server shutting down during build',
          completedAt: new Date(),
        })
        .where(inArray(schema.compilationJobs.id, orphanedIds));
    }

    this.activeJobs.clear();
    this.queue = [];
    this.jobs.clear();
  }

  private async failInProgressJobs(): Promise<void> {
    const db = getDb();
    const inProgress = await db
      .select()
      .from(schema.compilationJobs)
      .where(inArray(schema.compilationJobs.status, ['running', 'pending', 'queued']));

    if (inProgress.length === 0) return;

    await db
      .update(schema.compilationJobs)
      .set({
        status: 'failed',
        error: 'Server restarted during build',
        completedAt: new Date(),
      })
      .where(inArray(schema.compilationJobs.status, ['running', 'pending', 'queued']));

    console.log(`🧹 Marked ${inProgress.length} in-progress builds as failed`);

    if (env.APP_EDITION === 'cloud') {
      for (const job of inProgress) {
        if (job.userId) {
          try {
            await addCredits({
              userId: job.userId,
              amount: CREDIT_COSTS.compile,
              reason: `compile-refund-restart:${job.projectId ?? job.id}`,
            });
          } catch (refundError) {
            const logger = createLogger(job.id);
            logger.error(`Failed to refund credits: ${refundError}`);
          }
        }
      }
    }
  }

  async hasUserActiveJob(userId: string): Promise<boolean> {
    for (const job of this.jobs.values()) {
      if (job.userId === userId && ['pending', 'running', 'queued'].includes(job.status)) {
        return true;
      }
    }

    const db = getDb();
    const dbJobs = await db
      .select()
      .from(schema.compilationJobs)
      .where(
        and(
          eq(schema.compilationJobs.userId, userId),
          inArray(schema.compilationJobs.status, ['pending', 'running', 'queued']),
        ),
      )
      .limit(1);

    return dbJobs.length > 0;
  }

  async addJob(job: CompilationJob | NewCompilationJob): Promise<void> {
    if (this.circuitOpenAt) {
      const elapsed = Date.now() - this.circuitOpenAt;
      if (elapsed > CompilationQueue.CIRCUIT_RESET_MS) {
        this.circuitOpenAt = null;
        this.consecutiveFailures = 0;
        console.log('Circuit breaker reset');
      } else {
        throw new Error('Compilation service is temporarily unavailable due to repeated failures. Please try again later.');
      }
    }

    if (job.userId) {
      const hasActive = await this.hasUserActiveJob(job.userId);
      if (hasActive) {
        throw new Error('You already have an active compilation job. Please wait for it to finish.');
      }
    }

    const fullJob = job as CompilationJob;
    this.jobs.set(fullJob.id, fullJob);
    this.queue.push(fullJob);

    const db = getDb();
    await db.insert(schema.compilationJobs).values({
      id: job.id,
      projectId: job.projectId,
      userId: job.userId,
      projectName: job.projectName,
      config: job.config,
      configPath: job.configPath,
      template: job.template,
      status: job.status,
      createdAt: job.createdAt,
    });

    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isStopped || this.queue.length === 0) return;
    if (this.activeJobs.size >= this.maxWorkers) return;

    const job = this.queue.shift();
    if (!job) return;

    job.status = 'running';
    job.startedAt = new Date();

    const db = getDb();
    await db
      .update(schema.compilationJobs)
      .set({ status: 'running', startedAt: job.startedAt })
      .where(eq(schema.compilationJobs.id, job.id));

    this.emit('jobStarted', job);
    this.runCompilation(job);
    this.processQueue();
  }

  private async runCompilation(job: CompilationJob): Promise<void> {
    const logger = createLogger(job.id);
    const tempDir = join('/tmp/esphome-builds', job.projectId ?? job.id);
    const configFile = join(tempDir, 'config.yaml');

    try {
      await fs.mkdir(tempDir, { recursive: true });
      await copyStaticTemplates(tempDir);

      let firmwareUpdateUrl: string | undefined;
      if (job.projectId) {
        const db = getDb();
        const [proj] = await db
          .select({ firmwareToken: schema.projects.firmwareToken })
          .from(schema.projects)
          .where(eq(schema.projects.id, job.projectId));
        if (proj?.firmwareToken) {
          const baseUrl = env.PUBLIC_BASE_URL || `http://localhost:5173`;
          firmwareUpdateUrl = `${baseUrl}/api/firmware/${proj.firmwareToken}/manifest`;
        }
      }

      const project = JSON.parse(job.config) as Project;
      if (firmwareUpdateUrl) {
        project.secrets = { ...project.secrets, firmwareUpdateUrl };
      }

      const validationErrors = validateProject(project);
      if (validationErrors.length > 0) {
        const messages = validationErrors.map((e) => `[${e.type}] ${e.message}`).join('; ');
        throw new Error(`Project validation failed: ${messages}`);
      }

      await fs.writeFile(join(tempDir, 'includes', 'ui_types.h'), generateUITypesHeader(project));
      await fs.writeFile(join(tempDir, 'includes', 'ui_state.h'), generateUIStateHeader(project));
      await fs.writeFile(join(tempDir, 'includes', 'ui_screens.h'), generateUIScreensHeader(project));

      const fontsPath = join(tempDir, 'fonts.yaml');
      const baseFontsYaml = await fs.readFile(fontsPath, 'utf-8');
      await fs.writeFile(fontsPath, generateFontsYAML(project, baseFontsYaml));

      const esphomeYaml = generateESPHomeYAML(project, job.id);
      const secretsYaml = generateSecretsYAML(project);
      await fs.writeFile(configFile, esphomeYaml);
      await fs.writeFile(join(tempDir, 'secrets.yaml'), secretsYaml);

      const venvPath = env.ESPHOME_VENV;
      const childProcess = spawn(
        `${venvPath}/bin/python`,
        ['-m', 'esphome', 'compile', configFile],
        {
          cwd: tempDir,
          timeout: 300000,
          env: {
            ...env,
            PATH: `${venvPath}/bin:${env.PATH}`,
            VIRTUAL_ENV: venvPath,
            PYTHONPATH: this.pythonSitePackages || `${venvPath}/lib/python3.12/site-packages`,
            PLATFORMIO_PENV_NOT_USED: 'true',
            PLATFORMIO_CORE_DIR: join(tempDir, '.platformio'),
          },
          stdio: ['inherit', 'pipe', 'pipe'],
        },
      );

      this.activeJobs.set(job.id, { job, process: childProcess });

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data) => {
        stdout += data;
        logger.info(`stdout: ${data.toString().trim()}`);
      });

      childProcess.stderr?.on('data', (data) => {
        stderr += data;
        logger.warn(`stderr: ${data.toString().trim()}`);
      });

      childProcess.on('exit', async (code, signal) => {
        this.activeJobs.delete(job.id);
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (code === 0) {
          const deviceName = job.projectName
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
          const pioDir = join(tempDir, '.esphome', 'build', deviceName, '.pioenvs', deviceName);
          const candidates = ['firmware.factory.bin', 'firmware.bin'];

          let uploaded = false;
          let uploadError = '';
          for (const name of candidates) {
            const binPath = join(pioDir, name);
            try {
              await fs.access(binPath);
              const data = await fs.readFile(binPath);
              await uploadBinary(job.id, data);
              logger.info(`Binary uploaded to S3 (from ${name})`);
              uploaded = true;
              break;
            } catch (err: any) {
              uploadError = err.message || String(err);
            }
          }
          if (!uploaded) {
            const files = await fs.readdir(pioDir).catch(() => []);
            logger.error(`No firmware binary found in ${pioDir}. Files: ${files.join(', ')}. S3 error: ${uploadError}`);
          }

          logger.info(`Compilation succeeded`);
          await this.handleJobResult(job.id, { output: stdout });
        } else {
          const reason = signal
            ? `Compilation timed out and was terminated (signal: ${signal})`
            : `ESPHome compile failed (exit code ${code})`;
          const detail = stderr || stdout ? `: ${stderr || stdout}` : '';
          await this.handleJobResult(job.id, {
            error: `${reason}${detail}`,
          });
        }

        this.processQueue();
      });

      childProcess.on('error', async (error) => {
        this.activeJobs.delete(job.id);
        await this.handleJobResult(job.id, { error: error.message });
        this.processQueue();
      });
    } catch (error) {
      await this.handleJobResult(job.id, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.processQueue();
    }
  }

  private async handleJobResult(
    jobId: string,
    result: { output?: string; error?: string },
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    if (result.error) {
      job.status = 'failed';
      job.error = result.error;

      this.consecutiveFailures++;
      if (this.consecutiveFailures >= CompilationQueue.CIRCUIT_FAILURE_THRESHOLD && !this.circuitOpenAt) {
        this.circuitOpenAt = Date.now();
        console.warn(`Circuit breaker opened after ${this.consecutiveFailures} consecutive failures`);
      }

      if (env.APP_EDITION === 'cloud' && job.userId) {
        try {
          await addCredits({
            userId: job.userId,
            amount: CREDIT_COSTS.compile,
            reason: `compile-refund:${job.projectId ?? job.id}`,
          });
        } catch (refundError) {
          const logger = createLogger(job.id);
          logger.error(`Failed to refund credits: ${refundError}`);
        }
      }
    } else {
      job.status = 'completed';
      job.output = result.output ?? null;

      if (this.circuitOpenAt) {
        this.circuitOpenAt = null;
        console.log('Circuit breaker closed after successful compilation');
      }
      this.consecutiveFailures = 0;
    }
    job.completedAt = new Date();

    const db = getDb();
    await db
      .update(schema.compilationJobs)
      .set({
        status: job.status,
        output: job.output,
        error: job.error,
        completedAt: job.completedAt,
      })
      .where(eq(schema.compilationJobs.id, job.id));

    if (job.projectId) {
      await this.cleanupOldJobs(job.projectId);
    }

    this.emit('jobCompleted', job);
  }

  private async cleanupOldJobs(projectId: string): Promise<void> {
    const KEEP_COUNT = 10;
    const db = getDb();

    const allJobs = await db
      .select()
      .from(schema.compilationJobs)
      .where(eq(schema.compilationJobs.projectId, projectId))
      .orderBy(desc(schema.compilationJobs.createdAt));

    const unpinned = allJobs.filter((j) => !j.pinned);
    if (unpinned.length <= KEEP_COUNT) return;

    const jobsToDelete = unpinned.slice(KEEP_COUNT);
    const idsToDelete = jobsToDelete.map((j) => j.id);

    await deleteBinaries(idsToDelete);

    await db
      .delete(schema.compilationJobs)
      .where(inArray(schema.compilationJobs.id, idsToDelete));

    for (const id of idsToDelete) {
      this.jobs.delete(id);
    }

    console.log(`🧹 Cleaned up ${jobsToDelete.length} old builds for project ${projectId}`);
  }

  async getJob(jobId: string): Promise<CompilationJob | undefined> {
    const memoryJob = this.jobs.get(jobId);
    if (memoryJob) return memoryJob;

    const db = getDb();
    const dbJobs = await db
      .select()
      .from(schema.compilationJobs)
      .where(eq(schema.compilationJobs.id, jobId))
      .limit(1);

    if (dbJobs.length === 0) return undefined;
    return dbJobs[0];
  }

  async getAllJobs(): Promise<CompilationJob[]> {
    const db = getDb();
    return db.select().from(schema.compilationJobs).orderBy(desc(schema.compilationJobs.createdAt));
  }

  async getProjectJobs(projectId: string, limit = 10): Promise<CompilationJob[]> {
    const db = getDb();
    return db
      .select()
      .from(schema.compilationJobs)
      .where(eq(schema.compilationJobs.projectId, projectId))
      .orderBy(desc(schema.compilationJobs.createdAt))
      .limit(limit);
  }

  getStats(): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  } {
    let total = 0, pending = 0, running = 0, completed = 0, failed = 0;
    for (const job of this.jobs.values()) {
      total++;
      switch (job.status) {
        case 'pending':
        case 'queued':
          pending++;
          break;
        case 'running':
          running++;
          break;
        case 'completed':
          completed++;
          break;
        case 'failed':
          failed++;
          break;
      }
    }
    return { total, pending, running, completed, failed };
  }
}
