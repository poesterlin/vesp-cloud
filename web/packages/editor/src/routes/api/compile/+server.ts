import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getAllJobs, getProjectJobs, getJobStatus, submitCompilationJob } from "$lib/utils/worker";
import { deductCredits, CREDIT_COSTS, getBalance } from "$lib/credits";
import { env } from "$env/dynamic/private";
import { validateProject } from "$lib/codegen/validations";
import { validateProjectSchema } from "$lib/server/project-schema";
import { getDb } from "@vesp-cloud/db";
import { projects, type CompilationJob } from "@vesp-cloud/db/schema";
import { and, eq } from "drizzle-orm";
import type { Project } from "@vesp-cloud/schema";

const IS_CLOUD = env.APP_EDITION === "cloud";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USER_VISIBLE_COMPILE_ERROR = "Compilation failed. Try again later. Credit refunded.";

function serializeJob(job: CompilationJob): CompilationJob {
  return {
    ...job,
    output: null,
    error: job.status === "failed" && job.error ? USER_VISIBLE_COMPILE_ERROR : null,
  };
}

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId, projectName, config, configPath, template } = await request.json();

    if (!projectId || !projectName || !config) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    if (typeof projectId !== "string" || !UUID_REGEX.test(projectId)) {
      return json({ error: "Invalid project ID" }, { status: 400 });
    }

    const db = getDb();
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, locals.user.id)))
      .limit(1);

    if (!project) {
      return json({ error: "Project not found" }, { status: 404 });
    }

    let parsedConfig: Project;
    try {
      parsedConfig = JSON.parse(config);
    } catch {
      return json({ error: "Invalid project config JSON" }, { status: 400 });
    }
    const schemaValidation = validateProjectSchema(parsedConfig);
    if (!schemaValidation.valid) {
      return json(
        { error: `Project schema validation failed: ${schemaValidation.errors.join("; ")}` },
        { status: 400 },
      );
    }

    const validationErrors = validateProject(parsedConfig);
    if (validationErrors.length > 0) {
      const messages = validationErrors.map((e) => `[${e.type}] ${e.message}`).join("; ");
      return json({
        error: `Project validation failed: ${messages}`,
        validationErrors,
      }, { status: 400 });
    }

    if (IS_CLOUD) {
      const cost = CREDIT_COSTS.compile;
      const result = await deductCredits({
        userId: locals.user.id,
        amount: cost,
        reason: `compile:${projectId}`,
      });

      if (!result.success) {
        const balance = await getBalance(locals.user.id);
        return json(
          { error: `Insufficient credits. Cost: ${cost}, balance: ${balance}` },
          { status: 402 },
        );
      }
    }

    const result = await submitCompilationJob(
      projectId,
      projectName,
      config,
      configPath || "",
      locals.user.id,
      template,
    );

    return json(result);
  } catch (error: any) {
    if (error.message?.includes('already have an active compilation job')) {
      return json({ error: error.message }, { status: 429 });
    }
    console.error('Compile POST error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const jobId = url.searchParams.get("jobId");
    if (jobId) {
      if (!UUID_REGEX.test(jobId)) {
        return json({ error: "Invalid job ID" }, { status: 400 });
      }
      const status = await getJobStatus(jobId);
      if (!status || status.userId !== locals.user.id) {
        return json(null, { status: 404 });
      }
      return json(serializeJob(status));
    }

    const projectId = url.searchParams.get("projectId");
    const latest = url.searchParams.get("latest");

    if (projectId) {
      if (!UUID_REGEX.test(projectId)) {
        return json({ error: "Invalid project ID" }, { status: 400 });
      }

      const db = getDb();
      const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, locals.user.id)))
        .limit(1);

      if (!project) {
        return json({ error: "Project not found" }, { status: 404 });
      }
    }

    if (projectId && latest) {
      const jobs = await getProjectJobs(projectId, 10);
      const found = jobs.find((j) => j.status === "completed");
      return found ? json(serializeJob(found)) : json(null);
    }

    if (projectId) {
      const jobs = await getProjectJobs(projectId, 10);
      return json(jobs.map(serializeJob));
    }

    const allJobs = await getAllJobs();
    return json(allJobs.filter((job) => job.userId === locals.user?.id).map(serializeJob));
  } catch (error: any) {
    console.error('Compile GET error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
