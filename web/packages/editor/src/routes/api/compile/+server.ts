import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getAllJobs, getProjectJobs, getJobStatus, submitCompilationJob } from "$lib/utils/worker";
import { deductCredits, CREDIT_COSTS, getBalance } from "$lib/credits";
import { env } from "$env/dynamic/private";
import { validateProject } from "$lib/codegen/validations";
import type { Project } from "@esphome-designer/schema";

const IS_CLOUD = env.APP_EDITION === "cloud";

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId, projectName, config, configPath, template } = await request.json();

    if (!projectId || !projectName || !config) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    let parsedConfig: Project;
    try {
      parsedConfig = JSON.parse(config);
    } catch {
      return json({ error: "Invalid project config JSON" }, { status: 400 });
    }
    const validationErrors = validateProject(parsedConfig);
    if (validationErrors.length > 0) {
      const messages = validationErrors.map((e) => `[${e.type}] ${e.message}`).join("; ");
      return json({ error: `Project validation failed: ${messages}` }, { status: 400 });
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
    return json({ error: error.message }, { status: 500 });
  }
};

export const GET: RequestHandler = async ({ url }) => {
  try {
    const jobId = url.searchParams.get("jobId");
    if (jobId) {
      const status = await getJobStatus(jobId);
      return json(status);
    }

    const projectId = url.searchParams.get("projectId");
    const latest = url.searchParams.get("latest");

    if (projectId && latest) {
      const jobs = await getProjectJobs(projectId, 10);
      const found = jobs.find((j) => j.status === "completed");
      return found ? json(found) : json(null);
    }

    if (projectId) {
      const jobs = await getProjectJobs(projectId, 10);
      return json(jobs);
    }

    const allJobs = await getAllJobs();
    return json(allJobs);
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
};
