import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '@vesp-cloud/db';
import { projects, compilationJobs } from '@vesp-cloud/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getOtaBinaryStats, otaBinaryExists, ensureS3, factoryBinKey } from '$lib/server/s3';
import { createLogger } from '$lib/server/logger';
import { diffProject } from '$lib/diff';
import type { Project } from '@vesp-cloud/schema';

function releaseSummary(currentConfig: string | null, previousConfig: string | null): string | undefined {
  if (!currentConfig) return undefined;
  if (!previousConfig) return 'First build';

  try {
    const current = JSON.parse(currentConfig) as Project;
    const previous = JSON.parse(previousConfig) as Project;
    const changes = diffProject(current, previous).items.map((item) => item.message);
    return changes.length > 0 ? changes.join('\n') : 'No changes';
  } catch {
    return undefined;
  }
}

export const GET: RequestHandler = async ({ params, url, request }) => {
  const db = getDb();
  const logger = createLogger(params.token);
  const userAgent = request.headers.get('user-agent') ?? 'unknown';

  logger.info(`manifest request: path=${url.pathname} device="${userAgent}"`);

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.firmwareToken, params.token));

  if (!project) {
    logger.warn('manifest request rejected: token not found');
    error(404, 'Not found');
  }

  const [job] = await db
    .select({ id: compilationJobs.id, config: compilationJobs.config, completedAt: compilationJobs.completedAt })
    .from(compilationJobs)
    .where(
      and(
        eq(compilationJobs.projectId, project.id),
        eq(compilationJobs.status, 'completed'),
        eq(compilationJobs.published, true),
      ),
    )
    .orderBy(desc(compilationJobs.completedAt));

  if (!job) {
    logger.warn(`manifest request rejected: no published firmware for project=${project.id}`);
    error(404, 'No published firmware');
  }

  if (!(await otaBinaryExists(job.id))) {
    logger.warn(`manifest request rejected: OTA binary missing for job=${job.id}`);
    error(404, 'OTA binary not found');
  }

  const { size, md5 } = await getOtaBinaryStats(job.id);
  logger.info(`manifest check: projectId=${project.id} device="${userAgent}" size=${size}`);

  const firmwarePath = `${url.origin}/api/firmware/${params.token}`;
  const factoryPath = `${url.origin}/api/firmware/${params.token}/factory`;
  const completedJobs = await db
    .select({ id: compilationJobs.id, config: compilationJobs.config })
    .from(compilationJobs)
    .where(
      and(
        eq(compilationJobs.projectId, project.id),
        eq(compilationJobs.status, 'completed'),
      ),
    )
    .orderBy(desc(compilationJobs.completedAt));
  const jobIndex = completedJobs.findIndex((completedJob) => completedJob.id === job.id);
  const summary = releaseSummary(job.config, jobIndex >= 0 ? (completedJobs[jobIndex + 1]?.config ?? null) : null);

  const s3 = ensureS3();
  const factoryFile = s3.file(factoryBinKey(job.id));
  const hasFactory = await factoryFile.exists();

  return json({
    name: 'vESP.cloud Firmware',
    version: job.id,
    builds: [
      {
        chipFamily: 'ESP32-S3',
        ...(hasFactory
          ? {
              parts: [
                {
                  path: factoryPath,
                  offset: 0,
                },
              ],
            }
          : {}),
        ota: {
          md5,
          path: firmwarePath,
          release_url: firmwarePath,
          ...(summary ? { summary } : {}),
        },
      },
    ],
  });
};
