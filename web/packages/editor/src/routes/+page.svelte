<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { onMount } from "svelte";
  import type { DisplayConfig } from "@esphome-designer/schema";
  
  // Define it here if the import fails
  type ProjectConfig = { 
    display?: Partial<DisplayConfig>, 
    theme?: any, // Using any for Theme to avoid complex import for now
    dashboardPages?: number,
    detailViews?: string[] 
  };

  let projects = $state<{ id: string; name: string; updatedAt: string }[]>([]);
  let showModal = $state(false);
  
  // New Project Form State
  let newProjectName = $state("");
  let displayWidth = $state(240);
  let displayHeight = $state(320);
  let displayPlatform = $state<DisplayConfig["platform"]>("ili9xxx");
  let numPages = $state(1);
  let detailViewsString = $state("");

  onMount(() => {
    projects = projectStore.listProjects();
  });

  function createProject() {
    if (!newProjectName.trim()) return;
    
    const detailViews = detailViewsString
      .split(",")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const config: ProjectConfig = {
      display: {
        width: displayWidth,
        height: displayHeight,
        platform: displayPlatform
      },
      dashboardPages: numPages,
      detailViews
    };

    const project = (projectStore.createNewProject as any)(newProjectName, config);
    window.location.href = `/project/${project.id}`;
  }

  function deleteProject(id: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (confirm("Are you sure you want to delete this project?")) {
      projectStore.deleteProject(id);
      projects = projectStore.listProjects();
    }
  }
</script>

<div class="project-selector">
  <header>
    <h1>ESPHome Designer</h1>
    <p>Visual editor for ESPHome display configurations</p>
  </header>

  <main>
    <section class="actions">
      <button class="primary large" onclick={() => showModal = true}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Create New Project
      </button>
    </section>

    {#if showModal}
      <div class="modal-backdrop" onclick={() => showModal = false}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
          <h2>New Project</h2>
          <div class="form-grid">
            <div class="field">
              <label for="name">Project Name</label>
              <input
                id="name"
                type="text"
                placeholder="My Awesome Display"
                bind:value={newProjectName}
                autofocus
              />
            </div>

            <div class="field-group">
              <div class="field">
                <label for="width">Width</label>
                <input id="width" type="number" bind:value={displayWidth} />
              </div>
              <div class="field">
                <label for="height">Height</label>
                <input id="height" type="number" bind:value={displayHeight} />
              </div>
            </div>

            <div class="field">
              <label for="platform">Display Platform</label>
              <select id="platform" bind:value={displayPlatform}>
                <option value="ili9xxx">ILI9xxx</option>
                <option value="st7789">ST7789</option>
                <option value="ssd1306">SSD1306</option>
                <option value="waveshare_epaper">Waveshare E-Paper</option>
              </select>
            </div>

            <div class="field">
              <label for="pages">Initial Pages</label>
              <input id="pages" type="number" min="1" max="10" bind:value={numPages} />
            </div>

            <div class="field">
              <label for="details">Detail Views (comma separated)</label>
              <input 
                id="details" 
                type="text" 
                placeholder="Vacuum, Lights, Climate" 
                bind:value={detailViewsString} 
              />
            </div>
          </div>

          <div class="modal-actions">
            <button class="secondary" onclick={() => showModal = false}>Cancel</button>
            <button class="primary" onclick={createProject} disabled={!newProjectName.trim()}>
              Create Project
            </button>
          </div>
        </div>
      </div>
    {/if}

    <section class="project-list">
      <h2>Your Projects</h2>
      {#if projects.length === 0}
        <div class="empty-state">
          <p>No projects yet. Create one to get started!</p>
        </div>
      {:else}
        <div class="grid">
          {#each projects as project}
            <a href="/project/{project.id}" class="project-card">
              <div class="project-info">
                <h3>{project.name}</h3>
                <span class="date">Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
              </div>
              <button class="delete-btn" onclick={(e) => deleteProject(project.id, e)} title="Delete Project">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                </svg>
              </button>
            </a>
          {/each}
        </div>
      {/if}
    </section>
  </main>
</div>

<style>
  .project-selector {
    max-width: 1000px;
    margin: 0 auto;
    padding: var(--spacing-xl);
  }

  header {
    text-align: center;
    margin-bottom: var(--spacing-xxl);
  }

  h1 {
    font-size: 3rem;
    margin-bottom: var(--spacing-xs);
    background: linear-gradient(135deg, var(--color-accent), #4facfe);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  header p {
    color: var(--color-text-secondary);
    font-size: 1.2rem;
  }

  .actions {
    display: flex;
    justify-content: center;
    margin-bottom: var(--spacing-xxl);
  }

  button.large {
    padding: var(--spacing-md) var(--spacing-xl);
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .modal {
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-xl);
    width: 100%;
    max-width: 500px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  }

  .modal h2 {
    margin-top: 0;
    border: none;
  }

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    margin: var(--spacing-lg) 0;
  }

  .field-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-md);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .field label {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
  }

  .field input, .field select {
    padding: var(--spacing-sm);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
    margin-top: var(--spacing-xl);
  }

  .project-list {
    margin-bottom: var(--spacing-xxl);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--spacing-lg);
  }

  .project-card {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: var(--spacing-lg);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    text-decoration: none;
    transition: all 0.2s;
  }

  .project-card:hover {
    border-color: var(--color-accent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .project-info h3 {
    margin: 0 0 var(--spacing-xs) 0;
    color: var(--color-text-primary);
  }

  .date {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .delete-btn {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    padding: var(--spacing-xs);
    border-radius: var(--radius-sm);
    opacity: 0;
    transition: all 0.2s;
  }

  .project-card:hover .delete-btn {
    opacity: 1;
  }

  .delete-btn:hover {
    color: #ff5252;
    background: rgba(255, 82, 82, 0.1);
  }

  .empty-state {
    text-align: center;
    padding: var(--spacing-xxl);
    color: var(--color-text-muted);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    border: 2px dashed var(--color-border);
  }
</style>
