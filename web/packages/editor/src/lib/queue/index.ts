import { EventEmitter } from 'events';
import { exec, spawn, type ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { getDb, schema } from '$lib/db/index.js';
import { eq, desc } from 'drizzle-orm';
import type { CompilationJob } from '$lib/db/schema';
import { env } from '$env/dynamic/private';
import type { Project } from '@esphome-designer/schema';
import { generateESPHomeYAML } from '$lib/codegen/esphome';
import { generateCppRenderer } from '$lib/codegen/cpp';
import { generateStateHeader } from '$lib/codegen/state-manager';
import { generateTouchHandler } from '$lib/codegen/touch-handler';
import { generateSensorsYAML } from '$lib/codegen/sensors';
import { generateRenderHelpers } from '$lib/codegen/render-helpers';
import { generateRenderPages } from '$lib/codegen/render-pages';
import { generateRenderDetails } from '$lib/codegen/render-details';

interface ActiveJob {
  job: CompilationJob;
  process: ChildProcess;
}

export class CompilationQueue extends EventEmitter {
  private activeJobs: Map<string, ActiveJob> = new Map();
  private queue: CompilationJob[] = [];
  private jobs: Map<string, CompilationJob> = new Map();
  private isStopped = false;

  constructor(private maxWorkers: number = 2) {
    super();
  }

  async start(): Promise<void> {
    console.log(`🚀 Starting compilation queue with ${this.maxWorkers} slots`);
    this.isStopped = false;
    this.processQueue();
  }

  async stop(): Promise<void> {
    console.log('⏹️  Stopping compilation queue');
    this.isStopped = true;

    // Kill all active processes
    for (const { process } of this.activeJobs.values()) {
      process.kill();
    }

    this.activeJobs.clear();
    this.queue = [];
    this.jobs.clear();
  }

  async addJob(job: CompilationJob): Promise<void> {
    this.jobs.set(job.id, job);
    this.queue.push(job);

    // Persist to database
    const db = getDb();
    await db.insert(schema.compilationJobs).values({
      id: job.id,
      projectId: job.projectId,
      projectName: job.projectName,
      config: job.config,
      configPath: job.configPath,
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

    // Update database
    const db = getDb();
    await db.update(schema.compilationJobs)
      .set({
        status: 'running',
        startedAt: job.startedAt,
      })
      .where(eq(schema.compilationJobs.id, job.id));

    this.emit('jobStarted', job);
    this.runCompilation(job);

    // Try to start another job if slots are available
    this.processQueue();
  }

  private async runCompilation(job: CompilationJob): Promise<void> {
    const tempDir = join('/tmp/esphome-builds', job.projectId);
    const configFile = join(tempDir, 'config.yaml');

    try {
      await fs.mkdir(tempDir, { recursive: true });
      const includesDir = join(tempDir, 'includes');
      await fs.mkdir(includesDir, { recursive: true });

      const project = JSON.parse(job.config) as Project;

      // Generate ESPHome YAML
      const esphomeYaml = generateESPHomeYAML(project);
      await fs.writeFile(configFile, esphomeYaml);

      // Generate State Manager (dependency)
      const stateManager = generateStateHeader(project);
      await fs.writeFile(join(includesDir, 'state_manager.h'), stateManager);

      // Generate Render Helpers (dependency)
      const renderHelpers = generateRenderHelpers(project);
      await fs.writeFile(join(includesDir, 'render_helpers.h'), renderHelpers);

      // Generate Pages (dependency)
      const renderPages = generateRenderPages(project);
      await fs.writeFile(join(includesDir, 'render_pages.h'), renderPages);

      // Generate Details (dependency)
      const renderDetails = generateRenderDetails(project);
      await fs.writeFile(join(includesDir, 'render_details.h'), renderDetails);

      // Generate C++ Renderer (main entry point)
      const cppRenderer = generateCppRenderer(project);
      await fs.writeFile(join(includesDir, 'display_renderer.h'), cppRenderer);

      // Generate Touch Handler
      const touchHandler = generateTouchHandler(project);
      await fs.writeFile(join(includesDir, 'touch_handler.h'), touchHandler);

      // Generate Sensors YAML
      const sensorsYaml = generateSensorsYAML(project);
      await fs.writeFile(join(tempDir, 'sensors.yaml'), sensorsYaml);

      const venvPath = env.ESPHOME_VENV;
        const childProcess = spawn(`${venvPath}/bin/python`,
        ['-m', 'esphome', 'compile', configFile],
        {
          cwd: tempDir,
          timeout: 300000,
          env: {
            ...env,
            // Add the venv bin to the start of PATH
            PATH: `${venvPath}/bin:${process.env.PATH}`,
            // Tell Python and ESPHome where the virtualenv is
            VIRTUAL_ENV: venvPath,
            PYTHONPATH: `${venvPath}/lib/python3.11/site-packages`, // Adjust version if needed
            // CRITICAL: Tell PlatformIO not to try creating its own virtualenv
            PLATFORMIO_PENV_NOT_USED: 'true',
            // Optional: Keep platformio data inside the build dir to avoid permission issues
            PLATFORMIO_CORE_DIR: join(tempDir, '.platformio'),
          },
          stdio: ['inherit', 'pipe', 'pipe'],
        }
      );

      this.activeJobs.set(job.id, { job, process: childProcess });

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data) => {
        stdout += data;
        console.log(`[Job ${job.id}]: ${data}`);
      });

      childProcess.stderr?.on('data', (data) => {
        stderr += data;
        console.error(`[Job ${job.id} ERROR]: ${data}`);
      });

      childProcess.on('exit', async (code) => {
        this.activeJobs.delete(job.id);

        await new Promise(resolve => setTimeout(resolve, 100));

        if (code === 0) {
          // .esphome/build/testing/.pioenvs/testing/firmware.bin
          const binPath = join(tempDir, '.esphome', 'build', job.projectName, '.pioenvs', job.projectName, 'firmware.bin');
          const publicDest = join(process.cwd(), 'static', 'builds', `${job.id}.bin`);
          try {
            // TODO: upload to s3
            await fs.copyFile(binPath, publicDest);
            console.log(`Binary saved to ${publicDest}`);
          } catch (e) {
            console.error('Binary not found. Check if it is an ESP8266 (firmware.bin) or ESP32 (firmware.factory.bin)', e);
          }

          await this.handleJobResult(job.id, { output: stdout });
        } else {
          await this.handleJobResult(job.id, { error: `ESPHome compile failed (code ${code}): ${stderr}, ${stdout}` });
        }

        // TODO: Cleanup temp dirs of older projects periodically
        // try {
        //   await fs.rm(tempDir, { recursive: true, force: true });
        // } catch (e) {
        //   console.error('Failed to cleanup temp directory:', e);
        // }

        this.processQueue();
      });



      childProcess.on('error', async (error) => {
        this.activeJobs.delete(job.id);
        await this.handleJobResult(job.id, { error: error.message });
        this.processQueue();
      });

    } catch (error) {
      await this.handleJobResult(job.id, { error: error instanceof Error ? error.message : 'Unknown error' });
      this.processQueue();
    }
  }

  private async handleJobResult(jobId: string, result: { output?: string; error?: string }): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    if (result.error) {
      job.status = 'failed';
      job.error = result.error;
    } else {
      job.status = 'completed';
      job.output = result.output ?? null;
    }

    job.completedAt = new Date();

    // Update database
    const db = getDb();
    await db.update(schema.compilationJobs)
      .set({
        status: job.status,
        output: job.output,
        error: job.error,
        completedAt: job.completedAt,
      })
      .where(eq(schema.compilationJobs.id, job.id));

    this.emit('jobCompleted', job);
  }

  async getJob(jobId: string): Promise<CompilationJob | undefined> {
    const memoryJob = this.jobs.get(jobId);
    if (memoryJob) return memoryJob;

    const db = getDb();
    const dbJobs = await db.select()
      .from(schema.compilationJobs)
      .where(eq(schema.compilationJobs.id, jobId))
      .limit(1);

    if (dbJobs.length === 0) return undefined;

    const dbJob = dbJobs[0];
    return {
      id: dbJob.id,
      projectId: dbJob.projectId,
      projectName: dbJob.projectName,
      config: dbJob.config,
      configPath: dbJob.configPath ?? '',
      status: dbJob.status as any,
      output: dbJob.output ?? null,
      error: dbJob.error ?? null,
      createdAt: dbJob.createdAt,
      startedAt: dbJob.startedAt ?? null,
      completedAt: dbJob.completedAt ?? null,
    };
  }

  async getAllJobs(): Promise<CompilationJob[]> {
    const db = getDb();
    const dbJobs = await db.select()
      .from(schema.compilationJobs)
      .orderBy(desc(schema.compilationJobs.createdAt));

    return dbJobs.map(dbJob => ({
      id: dbJob.id,
      projectId: dbJob.projectId,
      projectName: dbJob.projectName,
      config: dbJob.config,
      configPath: dbJob.configPath ?? '',
      status: dbJob.status as any,
      output: dbJob.output ?? null,
      error: dbJob.error ?? null,
      createdAt: dbJob.createdAt,
      startedAt: dbJob.startedAt ?? null,
      completedAt: dbJob.completedAt ?? null,
    }));
  }

  getStats(): { total: number; pending: number; running: number; completed: number; failed: number } {
    // This is a bit inefficient to fetch all jobs from DB just for stats,
    // but keeping it consistent with the previous implementation for now.
    // In a real app, you'd likely want a more optimized way to get counts.
    return {
      total: 0, // Placeholder as we'd need to await getAllJobs()
      pending: this.queue.length,
      running: this.activeJobs.size,
      completed: 0,
      failed: 0
    };
  }
}
