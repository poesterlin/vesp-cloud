<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { generateESPHomeYAML } from "$lib/codegen/esphome";
  import { assert } from "$lib/utils";

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  let yamlOutput = $state("");
  let activeTab = $state<"yaml" | "history">("yaml");

  let compiling = $state(false);
  let currentJobId = $state<string | null>(null);
  let compilationStatus = $state<string | null>(null);
  let compilationHistory = $state<any[]>([]);
  let compilationOutput = $state<string | null>(null);

  // Generate on mount
  $effect(() => {
    generate();
    fetchHistory();
  });

  async function fetchHistory() {
    try {
      const response = await fetch("/api/compile");
      if (response.ok) {
        compilationHistory = await response.json();
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  }

  async function compile() {
    if (compiling) return;
    
    assert(projectStore.project, "No project loaded for compilation");
    compiling = true;
    compilationStatus = "Starting...";
    compilationOutput = null;

    try {
      const response = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectStore.project.id,
          projectName: projectStore.project.name,
          config: projectStore.exportJSON(),
        }),
      });

      if (!response.ok) throw new Error("Failed to start compilation");

      const { jobId } = await response.json();
      currentJobId = jobId;
      pollStatus(jobId);
    } catch (err: any) {
      compilationStatus = `Error: ${err.message}`;
      compiling = false;
    }
  }

  async function pollStatus(jobId: string) {
    const poll = async () => {
      try {
        const response = await fetch(`/api/compile?jobId=${jobId}`);
        if (!response.ok) throw new Error("Failed to get status");

        const job = await response.json();
        compilationStatus = job.status;

        if (job.status === "completed") {
          compilationOutput = job.output;
          compiling = false;
          fetchHistory();
        } else if (job.status === "failed") {
          compilationOutput = job.error;
          compiling = false;
          fetchHistory();
        } else {
          setTimeout(poll, 2000);
        }
      } catch (err: any) {
        compilationStatus = `Error: ${err.message}`;
        compiling = false;
      }
    };

    poll();
  }

  function generate() {
    if (!projectStore.project) {
      yamlOutput = "# No project loaded.";
      return;
    }

    try {
      yamlOutput = generateESPHomeYAML(projectStore.project);
    } catch (err) {
      console.error("Code generation failed:", err);
      yamlOutput = `# Error generating YAML: ${err}`;
    }
  }


  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  const currentOutput = $derived(yamlOutput);
</script>

<div class="export-panel">
  <div class="header">
    <h2>Export Code</h2>
    <button class="close-btn" onclick={onClose}>Close</button>
  </div>

  <div class="actions">
    <button onclick={() => copyToClipboard(currentOutput)}>Copy to Clipboard</button>
    <button class="compile-btn" class:loading={compiling} disabled={compiling} onclick={compile}>
      {compiling ? `Compiling (${compilationStatus})...` : "Compile with ESPHome"}
    </button>
  </div>

  <div class="tabs">
    <button class:active={activeTab === "yaml"} onclick={() => (activeTab = "yaml")}>
      ESPHome YAML
    </button>
    <button class:active={activeTab === "history"} onclick={() => (activeTab = "history")}>
      History
    </button>
  </div>

  <div class="code-container">
    {#if activeTab === "history"}
      <div class="history-list">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th>Project</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each compilationHistory as job}
              <tr>
                <td>{new Date(job.createdAt).toLocaleString()}</td>
                <td>
                  <span class="status-badge {job.status}">{job.status}</span>
                </td>
                <td>{job.projectName}</td>
                <td>
                  <button class="text-btn" onclick={() => {
                    compilationOutput = job.output || job.error;
                    activeTab = "yaml"; // Switch to code view to show output if we had a dedicated output view
                  }}>View Logs</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      {#if compilationOutput && activeTab === "yaml"}
        <div class="compilation-output">
          <h3>Compilation Output:</h3>
          <pre class="log"><code>{compilationOutput}</code></pre>
          <hr />
        </div>
      {/if}
      <pre><code>{currentOutput}</code></pre>
    {/if}
  </div>
</div>

<style>
  .export-panel {
    width: 800px;
    max-width: 90vw;
    display: flex;
    flex-direction: column;
    height: 80vh;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--color-border);
  }

  h2 {
    font-size: 18px;
    font-weight: 600;
  }

  .close-btn {
    background: transparent;
    padding: var(--spacing-xs) var(--spacing-sm);
  }

  .actions {
    display: flex;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--color-border);
    flex-wrap: wrap;
  }

  .compile-btn {
    background: #4caf50;
    color: white;
    border: none;
    margin-left: auto;
  }

  .compile-btn:hover:not(:disabled) {
    background: #43a047;
  }

  .compile-btn.loading {
    background: #81c784;
    cursor: wait;
  }

  .tabs {
    display: flex;
    padding: 0 var(--spacing-md);
    border-bottom: 1px solid var(--color-border);
  }

  .tabs button {
    background: transparent;
    border-radius: 0;
    padding: var(--spacing-sm) var(--spacing-md);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }

  .tabs button.active {
    border-bottom-color: var(--color-accent);
    color: var(--color-accent);
  }

  .tabs button:hover:not(.active) {
    background: var(--color-bg-tertiary);
  }

  .code-container {
    flex: 1;
    overflow: auto;
  }

  .compilation-output {
    padding: var(--spacing-md);
    background: #1e1e1e;
    border-bottom: 1px solid #333;
  }

  .compilation-output h3 {
    font-size: 14px;
    margin-top: 0;
    color: #888;
  }

  .log {
    background: #000;
    max-height: 200px;
    overflow-y: auto;
  }

  pre {
    margin: 0;
    padding: var(--spacing-md);
    background: var(--color-bg-primary);
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  code {
    color: var(--color-text-primary);
  }

  .history-list {
    padding: var(--spacing-md);
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    text-align: left;
    padding: var(--spacing-sm);
    border-bottom: 2px solid var(--color-border);
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  td {
    padding: var(--spacing-sm);
    border-bottom: 1px solid var(--color-border);
    font-size: 13px;
  }

  .status-badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    text-transform: uppercase;
  }

  .status-badge.completed { background: #e8f5e9; color: #2e7d32; }
  .status-badge.failed { background: #ffebee; color: #c62828; }
  .status-badge.running { background: #e3f2fd; color: #1565c0; }
  .status-badge.pending { background: #f5f5f5; color: #616161; }

  .text-btn {
    background: transparent;
    border: none;
    color: var(--color-accent);
    cursor: pointer;
    padding: 0;
    font-size: 12px;
  }

  .text-btn:hover {
    text-decoration: underline;
  }
</style>
