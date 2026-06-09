import { projectStore } from "$lib/stores/project.svelte";
import { assert } from "$lib/utils";

interface DeploymentState {
  step: "idle" | "compiling" | "flash" | "publish" | "done";
  flow: "new" | "update" | null;
  compiling: boolean;
  progress: number;
  status: string;
  error: string | null;
  jobId: string | null;
  manifestUrl: string | null;
  published: boolean;
  publishing: boolean;
}

export type JobStatus = {
  id: string;
  projectId: string | null;
  projectName: string;
  status: string;
  published: boolean;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
  output: string | null;
  config?: string | null;
};

function createDeploymentStore() {
  let state = $state<DeploymentState>({
    step: "idle",
    flow: null,
    compiling: false,
    progress: 0,
    status: "",
    error: null,
    jobId: null,
    manifestUrl: null,
    published: false,
    publishing: false,
  });

  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  function reset() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
    state.step = "idle";
    state.flow = null;
    state.compiling = false;
    state.progress = 0;
    state.status = "";
    state.error = null;
    state.jobId = null;
    state.manifestUrl = null;
    state.published = false;
    state.publishing = false;
  }

  async function compile(flowType: "new" | "update") {
    assert(projectStore.project, "No project loaded");
    state.flow = flowType;
    state.compiling = true;
    state.error = null;
    state.progress = 0;
    state.status = "Submitting build...";
    state.step = "compiling";

    try {
      const response = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectStore.serverProjectId,
          projectName: projectStore.project.name,
          config: projectStore.exportJSON(),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to start compilation");

      state.jobId = data.jobId;
      state.published = false;
      state.progress = 10;
      state.status = "Build queued...";
      pollStatus(data.jobId);
    } catch (err: any) {
      state.error = err.message;
      state.compiling = false;
    }
  }

  async function pollStatus(jobId: string) {
    const poll = async () => {
      try {
        const response = await fetch(`/api/compile?jobId=${jobId}`);
        const job = await response.json();
        if (!response.ok) throw new Error(job.error || "Failed to get status");

        if (job.status === "queued") {
          state.status = "Waiting in queue...";
          state.progress = 15;
        } else if (job.status === "running") {
          state.status = "Compiling firmware...";
          state.progress = Math.min(state.progress + 5, 85);
        } else if (job.status === "completed") {
          state.progress = 100;
          state.status = "Build complete!";
          state.compiling = false;
          state.manifestUrl = `/api/manifest/${jobId}`;
          state.step = state.flow === "new" ? "flash" : "publish";
          return;
        } else if (job.status === "failed") {
          state.error = job.error || "Compilation failed";
          state.compiling = false;
          return;
        }

        pollTimer = setTimeout(poll, 2000);
      } catch (err: any) {
        state.error = err.message;
        state.compiling = false;
      }
    };
    poll();
  }

  async function publishBuild(jobId: string | null = state.jobId) {
    if (!jobId || state.publishing) return;
    state.publishing = true;
    try {
      const res = await fetch(`/api/compile/${jobId}/publish`, {
        method: "POST",
      });
      if (res.ok) {
        state.published = true;
        state.step = "done";
      }
    } catch (e) {
      console.error("Failed to publish", e);
    } finally {
      state.publishing = false;
    }
  }

  function restoreJob(jobId: string, status: string) {
    if (state.compiling) return;
    state.jobId = jobId;
    state.compiling = true;
    state.step = "compiling";
    state.error = null;
    state.published = false;

    if (status === "queued" || status === "pending") {
      state.status = "Waiting in queue...";
      state.progress = 15;
    } else if (status === "running") {
      state.status = "Compiling firmware...";
      state.progress = 50;
    } else {
      state.status = "Resuming...";
      state.progress = 30;
    }

    pollStatus(jobId);
  }

  return {
    get state() {
      return state;
    },
    compile,
    publishBuild,
    reset,
    restoreJob,
  };
}

export const deploymentStore = createDeploymentStore();
