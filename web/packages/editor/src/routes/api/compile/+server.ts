import { json } from "@sveltejs/kit";
import { existsSync } from "fs";
import { join } from "path";
import type { RequestHandler } from "./$types";
import { getAllJobs, getJobStatus, submitCompilationJob } from "$lib/utils/worker";

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId, projectName, config, configPath, template } = await request.json();

    if (!projectId || !projectName || !config) {
      return json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const result = await submitCompilationJob(
      projectId,
      projectName,
      config,
      configPath || "",
      locals.user.id,
      template
    );

    return json(result);
  } catch (error: any) {
    return json(
      { error: error.message },
      { status: 500 }
    );
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
      const allJobs = await getAllJobs();
      const found = allJobs.find(
        (j) =>
          j.projectId === projectId &&
          j.status === "completed" &&
          existsSync(join(process.cwd(), "static", "builds", `${j.id}.bin`)),
      );
      return found ? json(found) : json(null);
    }

    const allJobs = await getAllJobs();
    return json(allJobs);
  } catch (error: any) {
    return json(
      { error: error.message },
      { status: 500 }
    );
  }
};