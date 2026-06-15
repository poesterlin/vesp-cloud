import { EventEmitter } from 'events';
import { spawn, type ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { cpus } from 'os';
import { getDb, schema } from '@esphome-designer/db';
import { eq, desc, inArray, and } from 'drizzle-orm';
import type { CompilationJob, NewCompilationJob } from '@esphome-designer/db/schema';

import type { Project } from '@esphome-designer/schema';
import { generateESPHomeYAML, generateUITypesHeader, generateUIStateHeader, generateUIScreensHeader, generateFontsYAML } from '$lib/codegen/esphome';
import { generateSecretsYAML } from '$lib/codegen/secrets';
import { validateProject } from '$lib/codegen/validations';
import { sanitizeDeviceName } from '$lib/codegen/utils';
import { copyStaticTemplates } from '$lib/server/esphome-templates';
import { uploadOtaBinary, uploadFactoryBinary, deleteBinaries } from '$lib/server/s3';
import { addCredits, CREDIT_COSTS } from '$lib/credits';
import { createLogger } from '$lib/server/logger';
import { assert } from '$lib/utils';

interface ActiveJob {
  job: CompilationJob;
  process: ChildProcess;
  cpuSlot: number;
}

export class CompilationQueue extends EventEmitter {
  private activeJobs: Map<string, ActiveJob> = new Map();
  private queue: CompilationJob[] = [];
  private jobs: Map<string, CompilationJob> = new Map();
  private isStopped = false;
  private pythonSitePackages = '';
  private consecutiveFailures = 0;
  private circuitOpenAt: number | null = null;
  private cpuSlotFree: boolean[] = [];
  private totalCores = 0;
  private coresPerSlot = 0;

  private static CIRCUIT_FAILURE_THRESHOLD = 5;
  private static CIRCUIT_RESET_MS = 5 * 60_000;

  private static formatDurationMs(ms: number): string {
    return `${(ms / 1000).toFixed(2)}s`;
  }

  constructor(private maxWorkers: number = 2) {
    super();
  }

  async start(): Promise<void> {
    console.log(`🚀 Starting compilation queue with ${this.maxWorkers} slots`);
    this.isStopped = false;

    const cpuCount = parseInt(process.env.ESPHOME_COMPILE_CPUS || '0', 10) || cpus().length;
    this.totalCores = cpuCount;
    this.coresPerSlot = Math.max(1, Math.floor(cpuCount / this.maxWorkers));
    this.cpuSlotFree = Array(this.maxWorkers).fill(true);
    console.log(`   ${cpuCount} CPUs → ${this.coresPerSlot} cores per slot (${this.maxWorkers} slots)`);

    await this.resolvePythonSitePackages();
    await this.failInProgressJobs();
    this.processQueue();
  }

  private async resolvePythonSitePackages(): Promise<void> {
    const venvPath = process.env.ESPHOME_VENV;
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

    if (process.env.APP_EDITION === 'cloud') {
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

    const slotIndex = this.cpuSlotFree.findIndex((f) => f);
    if (slotIndex === -1) return;

    const job = this.queue.shift();
    if (!job) return;

    this.cpuSlotFree[slotIndex] = false;

    job.status = 'running';
    job.startedAt = new Date();

    const db = getDb();
    await db
      .update(schema.compilationJobs)
      .set({ status: 'running', startedAt: job.startedAt })
      .where(eq(schema.compilationJobs.id, job.id));

    this.emit('jobStarted', job);
    this.runCompilation(job, slotIndex);
    this.processQueue();
  }

  private async runCompilation(job: CompilationJob, slotIndex: number): Promise<void> {
    const logger = createLogger(job.id);
    const tempDir = join('/tmp/esphome-builds', job.projectId ?? job.id);
    const configFile = join(tempDir, 'config.yaml');
    const timings = {
      startedAt: Date.now(),
      templateCopyMs: 0,
      configPrepMs: 0,
      compileMs: 0,
      uploadMs: 0,
    };

    try {
      const templateCopyStart = Date.now();
      await fs.mkdir(tempDir, { recursive: true });
      await copyStaticTemplates(tempDir);
      timings.templateCopyMs = Date.now() - templateCopyStart;

      const configPrepStart = Date.now();
      let firmwareUpdateUrl: string | undefined;
      if (job.projectId) {
        const db = getDb();
        const [proj] = await db
          .select({ firmwareToken: schema.projects.firmwareToken })
          .from(schema.projects)
          .where(eq(schema.projects.id, job.projectId));

        assert(proj, "project not found");

        const envBaseUrl = process.env.PUBLIC_BASE_URL;
        const baseUrl = envBaseUrl || `http://localhost:5173`;
        logger.info(`firmwareUpdateUrl: PUBLIC_BASE_URL=${envBaseUrl ?? '<unset>'} baseUrl=${baseUrl} firmwareToken=${proj.firmwareToken}`);
        firmwareUpdateUrl = `${baseUrl}/api/firmware/${proj.firmwareToken}`;
        logger.info(`firmwareUpdateUrl final: ${firmwareUpdateUrl}`);
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

      await Promise.all([
        fs.writeFile(join(tempDir, 'includes', 'ui_types.h'), generateUITypesHeader(project)),
        fs.writeFile(join(tempDir, 'includes', 'ui_state.h'), generateUIStateHeader(project)),
        fs.writeFile(join(tempDir, 'includes', 'ui_screens.h'), generateUIScreensHeader(project)),
      ]);

      const fontsPath = join(tempDir, 'fonts.yaml');
      const baseFontsYaml = await fs.readFile(fontsPath, 'utf-8');
      await fs.writeFile(fontsPath, generateFontsYAML(project, baseFontsYaml));

      const esphomeYaml = generateESPHomeYAML(project, job.id);
      const secretsYaml = generateSecretsYAML(project);
      logger.info(`generated secrets.yaml:\n${secretsYaml}`);
      await Promise.all([
        fs.writeFile(configFile, esphomeYaml),
        fs.writeFile(join(tempDir, 'secrets.yaml'), secretsYaml),
      ]);
      timings.configPrepMs = Date.now() - configPrepStart;

      const env = process.env;
      const venvPath = env.ESPHOME_VENV;
      const coreDir = env.PLATFORMIO_CORE_DIR || '/data/platformio';
      const buildCacheDir = env.PLATFORMIO_BUILD_CACHE_DIR || '/data/pio-build-cache';
      const ccacheDir = env.CCACHE_DIR || '/data/ccache';

      const concurrentActive = this.activeJobs.size + 1;
      const buildJobs = concurrentActive > 1
        ? String(Math.max(1, Math.floor(this.totalCores / concurrentActive)))
        : undefined;

      const buildEnv: Record<string, string> = {
        ...env,
        PATH: `${venvPath}/bin:${env.PATH}`,
        VIRTUAL_ENV: venvPath!,
        PYTHONPATH: this.pythonSitePackages || `${venvPath}/lib/python3.12/site-packages`,
        PLATFORMIO_PENV_NOT_USED: 'true',
        PLATFORMIO_CORE_DIR: coreDir,
        PLATFORMIO_BUILD_CACHE_DIR: buildCacheDir,
        IDF_CCACHE_ENABLE: '1',
        CCACHE_DIR: ccacheDir,
        CCACHE_BASEDIR: '/tmp/esphome-builds',
        CCACHE_NOHASHDIR: 'true',
        CCACHE_SLOPPINESS: 'pch_defines,time_macros,include_file_mtime,include_file_ctime',
        CCACHE_MAXSIZE: '10G',
        CCACHE_COMPRESS: 'true',
        CCACHE_COMPRESSLEVEL: '1',
      };
      if (buildJobs) {
        buildEnv.IDF_BUILD_JOBS = buildJobs;
        logger.info(`build parallelism capped to ${buildJobs} jobs (${concurrentActive} concurrent builds, ${this.totalCores} cores)`);
      }

      const childProcess = spawn(
        `${venvPath}/bin/python`,
        ['-m', 'esphome', 'compile', configFile],
        {
          cwd: tempDir,
          timeout: 300000,
          env: buildEnv,
          stdio: ['inherit', 'pipe', 'pipe'],
        },
      );

      this.activeJobs.set(job.id, { job, process: childProcess, cpuSlot: slotIndex });
      const compileStart = Date.now();

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data) => {
        stdout += data;
        logger.debug(`stdout: ${data.toString().trim()}`);
      });

      childProcess.stderr?.on('data', (data) => {
        stderr += data;
        logger.warn(`stderr: ${data.toString().trim()}`);
      });

      childProcess.on('exit', async (code, signal) => {
        const active = this.activeJobs.get(job.id);
        this.activeJobs.delete(job.id);
        if (active) this.cpuSlotFree[active.cpuSlot] = true;
        await new Promise((resolve) => setTimeout(resolve, 100));
        timings.compileMs = Date.now() - compileStart;

        if (code === 0) {
          const uploadStart = Date.now();
          const deviceName = sanitizeDeviceName(job.projectName);
          const pioDir = join(tempDir, '.esphome', 'build', deviceName, '.pioenvs', deviceName);
          const candidates = [
            { name: 'firmware.ota.bin', upload: (data: Buffer) => uploadOtaBinary(job.id, data) },
            { name: 'firmware.bin', upload: (data: Buffer) => uploadOtaBinary(job.id, data) },
            { name: 'firmware.factory.bin', upload: (data: Buffer) => uploadFactoryBinary(job.id, data) },
          ];

          let otaUploaded = false;
          let factoryUploaded = false;
          let uploadError = '';
          await Promise.all(
            candidates.map(async ({ name, upload }) => {
              const binPath = join(pioDir, name);
              try {
                await fs.access(binPath);
                const data = await fs.readFile(binPath);
                await upload(data);
                if (name === 'firmware.ota.bin' || name === 'firmware.bin') otaUploaded = true;
                if (name === 'firmware.factory.bin') factoryUploaded = true;
                logger.info(`Binary uploaded to S3 (${name})`);
              } catch (err: any) {
                uploadError = err.message || String(err);
              }
            }),
          );
          timings.uploadMs = Date.now() - uploadStart;
          if (!otaUploaded) {
            const files = await fs.readdir(pioDir).catch(() => []);
            await this.handleJobResult(job.id, {
              error: `No OTA firmware binary found in ${pioDir}. Files: ${files.join(', ')}. Error: ${uploadError}`,
            });
            logger.info(
              `phase timings: templateCopy=${CompilationQueue.formatDurationMs(timings.templateCopyMs)} configPrep=${CompilationQueue.formatDurationMs(timings.configPrepMs)} compile=${CompilationQueue.formatDurationMs(timings.compileMs)} upload=${CompilationQueue.formatDurationMs(timings.uploadMs)} total=${CompilationQueue.formatDurationMs(Date.now() - timings.startedAt)}`,
            );
            this.processQueue();
            return;
          }
          if (!factoryUploaded) {
            logger.warn(`No factory firmware binary found in ${pioDir}. Error: ${uploadError}`);
          }

          logger.info(`Compilation succeeded`);
          logger.info(
            `phase timings: templateCopy=${CompilationQueue.formatDurationMs(timings.templateCopyMs)} configPrep=${CompilationQueue.formatDurationMs(timings.configPrepMs)} compile=${CompilationQueue.formatDurationMs(timings.compileMs)} upload=${CompilationQueue.formatDurationMs(timings.uploadMs)} total=${CompilationQueue.formatDurationMs(Date.now() - timings.startedAt)}`,
          );
          await this.handleJobResult(job.id, { output: stdout });
        } else {
          const reason = signal
            ? `Compilation timed out and was terminated (signal: ${signal})`
            : `ESPHome compile failed (exit code ${code})`;
          const detail = stderr || stdout ? `: ${stderr || stdout}` : '';
          logger.info(
            `phase timings: templateCopy=${CompilationQueue.formatDurationMs(timings.templateCopyMs)} configPrep=${CompilationQueue.formatDurationMs(timings.configPrepMs)} compile=${CompilationQueue.formatDurationMs(timings.compileMs)} total=${CompilationQueue.formatDurationMs(Date.now() - timings.startedAt)}`,
          );
          await this.handleJobResult(job.id, {
            error: `${reason}${detail}`,
          });
        }

        this.processQueue();
      });

      childProcess.on('error', async (error) => {
        const active = this.activeJobs.get(job.id);
        this.activeJobs.delete(job.id);
        if (active) this.cpuSlotFree[active.cpuSlot] = true;
        timings.compileMs = Date.now() - compileStart;
        logger.info(
          `phase timings: templateCopy=${CompilationQueue.formatDurationMs(timings.templateCopyMs)} configPrep=${CompilationQueue.formatDurationMs(timings.configPrepMs)} compile=${CompilationQueue.formatDurationMs(timings.compileMs)} total=${CompilationQueue.formatDurationMs(Date.now() - timings.startedAt)}`,
        );
        await this.handleJobResult(job.id, { error: error.message });
        this.processQueue();
      });
    } catch (error) {
      logger.info(
        `phase timings: templateCopy=${CompilationQueue.formatDurationMs(timings.templateCopyMs)} configPrep=${CompilationQueue.formatDurationMs(timings.configPrepMs)} total=${CompilationQueue.formatDurationMs(Date.now() - timings.startedAt)}`,
      );
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

      if (process.env.APP_EDITION === 'cloud' && job.userId) {
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
