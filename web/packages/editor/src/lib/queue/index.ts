import { EventEmitter } from 'events';
import { exec, spawn, type ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { getDb, schema } from '$lib/db/index.js';
import { eq, desc } from 'drizzle-orm';
import type { CompilationJob, NewCompilationJob } from '$lib/db/schema';
import { env } from '$env/dynamic/private';
import type { Project } from '@esphome-designer/schema';
import { generateESPHomeYAML } from '$lib/codegen/esphome';
import { generateSecretsYAML } from '$lib/codegen/secrets';
import { generateHardwareYAML } from '$lib/codegen/hardware';
import { generateInitialFlashYAML } from '$lib/codegen/initial-flash';
import { getStaticBuildsDir } from '$lib/server/static-paths';

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

  async addJob(job: CompilationJob | NewCompilationJob): Promise<void> {
    const fullJob = job as CompilationJob;
    this.jobs.set(fullJob.id, fullJob);
    this.queue.push(fullJob);

    // Persist to database
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
    const tempDir = join('/tmp/esphome-builds', job.projectId ?? job.id);
    const configFile = join(tempDir, 'config.yaml');

    try {
      await fs.mkdir(tempDir, { recursive: true });

      // Create packages directory for hardware config
      const packagesDir = join(tempDir, 'packages');
      await fs.mkdir(packagesDir, { recursive: true });

      // Look up firmware token to generate the OTA manifest URL
      let firmwareUpdateUrl: string | undefined;
      if (job.projectId) {
        const db = getDb();
        const [proj] = await db.select({ firmwareToken: schema.projects.firmwareToken })
          .from(schema.projects)
          .where(eq(schema.projects.id, job.projectId));
        if (proj?.firmwareToken) {
          const baseUrl = env.PUBLIC_BASE_URL || `http://localhost:5173`;
          firmwareUpdateUrl = `${baseUrl}/api/firmware/${proj.firmwareToken}/manifest`;
        }
      }

      let esphomeYaml: string;
      let secretsYaml: string;

      if (job.template === 'initial') {
        // Initial flash mode: use the lightweight setup firmware
        esphomeYaml = generateInitialFlashYAML(job.projectName);
        // Generate minimal secrets with just the firmware URL
        secretsYaml = `# ESPHome Secrets (Initial Flash)\nfirmware_update_url: "${firmwareUpdateUrl ?? "http://YOUR_SERVER/api/firmware/YOUR_TOKEN/manifest"}"`;
      } else {
        // Full dashboard mode: generate from project config
        const project = JSON.parse(job.config) as Project;
        if (firmwareUpdateUrl) {
          project.secrets = {
            ...project.secrets,
            firmwareUpdateUrl,
          };
        }
        esphomeYaml = generateESPHomeYAML(project, job.id);
        secretsYaml = generateSecretsYAML(project);
      }

      // Write ESPHome YAML
      await fs.writeFile(configFile, esphomeYaml);

      // Write LVGL hardware package
      await fs.writeFile(join(packagesDir, 'lvgl_hardware.yaml'), generateHardwareYAML());

      // Write Secrets YAML
      await fs.writeFile(join(tempDir, 'secrets.yaml'), secretsYaml);

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
          // ESPHome uses sanitized device name for build directory
          const deviceName = job.projectName
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
          const pioDir = join(tempDir, '.esphome', 'build', deviceName, '.pioenvs', deviceName);
          const candidates = ['firmware.factory.bin', 'firmware.bin'];
          const buildsDir = getStaticBuildsDir();
          const publicDest = join(buildsDir, `${job.id}.bin`);
          await fs.mkdir(buildsDir, { recursive: true });

          let copied = false;
          for (const name of candidates) {
            const binPath = join(pioDir, name);
            try {
              await fs.access(binPath);
              await fs.copyFile(binPath, publicDest);
              console.log(`Binary saved to ${publicDest} (from ${name})`);
              copied = true;
              break;
            } catch {}
          }
          if (!copied) {
            const files = await fs.readdir(pioDir).catch(() => []);
            console.error(`No firmware binary found in ${pioDir}. Files: ${files.join(', ')}`);
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

    return dbJobs[0];
  }

  async getAllJobs(): Promise<CompilationJob[]> {
    const db = getDb();
    return db.select()
      .from(schema.compilationJobs)
      .orderBy(desc(schema.compilationJobs.createdAt));
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
