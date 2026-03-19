<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { homeAssistantStore } from "$lib/stores/homeassistant.svelte";
  import { onMount } from "svelte";
  import { fade, fly, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import * as mdiIcons from '@mdi/js';
  import { goto } from '$app/navigation';
  import DeviceSetupWizard from '$lib/components/DeviceSetupWizard.svelte';

  type ProjectConfig = {
    display?: { width: number; height: number },
    theme?: any,
    dashboardPages?: number,
    detailViews?: string[]
  };

  let { data } = $props();
  let projects = $state<{ id: string; name: string; updatedAt: string }[]>([]);

  $effect(() => {
    projects = data.projects ?? [];
  });
  let showModal = $state(false);

  // Device setup wizard state
  let showSetupWizard = $state(false);
  let newlyCreatedProject = $state<{ id: string; name: string } | null>(null);

  // New Project Form State
  let newProjectName = $state("");

  // HomeAssistant Import State
  let haFileInput: HTMLInputElement;
  let haImportError = $state<string | null>(null);
  let haImportSuccess = $state(false);

  async function handleHAFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    haImportError = null;
    haImportSuccess = false;

    try {
      const text = await file.text();
      const success = homeAssistantStore.importFromJson(text);
      if (success) {
        haImportSuccess = true;
        setTimeout(() => haImportSuccess = false, 3000);
      } else {
        haImportError = "Invalid HomeAssistant dump format";
      }
    } catch {
      haImportError = "Failed to read file";
    }

    input.value = "";
  }

  function clearHADump() {
    homeAssistantStore.clear();
  }

  // localStorage migration on first load
  onMount(async () => {
    const localProjects = projectStore.getLocalStorageProjects();
    if (localProjects.length > 0) {
      for (const lp of localProjects) {
        const data = projectStore.getLocalProjectData(lp.id);
        if (data) {
          try {
            await fetch('/api/projects', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: data.name, data }),
            });
          } catch (e) {
            console.error('Migration failed for', lp.name, e);
          }
        }
      }
      projectStore.clearLocalStorage();
      // Refresh the list
      projects = await projectStore.listProjects();
    }
  });

  async function createProject() {
    if (!newProjectName.trim()) return;

    const config: ProjectConfig = {
      display: { width: 480, height: 480 }
    };

    const project = await projectStore.createNewProject(newProjectName, config);
    const projectId = projectStore.serverProjectId;
    const createdName = newProjectName;
    
    // Reset form and show the device setup wizard instead of immediately navigating
    newProjectName = "";
    showModal = false;
    newlyCreatedProject = { id: projectId!, name: createdName };
    showSetupWizard = true;
    
    // Refresh the project list
    projects = await projectStore.listProjects();
  }

  function handleWizardClose() {
    showSetupWizard = false;
    if (newlyCreatedProject) {
      goto(`/project/${newlyCreatedProject.id}`);
    }
    newlyCreatedProject = null;
  }

  function handleWizardSkip() {
    showSetupWizard = false;
    if (newlyCreatedProject) {
      goto(`/project/${newlyCreatedProject.id}`);
    }
    newlyCreatedProject = null;
  }

  async function deleteProject(id: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (confirm("Are you sure you want to delete this project?")) {
      await projectStore.deleteProject(id);
      projects = await projectStore.listProjects();
    }
  }
</script>

<div class="project-selector">
  <div class="glow-bg"></div>
  
  <header in:fly={{ y: -20, duration: 800, easing: cubicOut }}>
    <h1>ESPHome Designer</h1>
    <p>The visual architect for your smart home displays</p>
  </header>

  <main>
    <section class="actions" in:fade={{ delay: 200, duration: 800 }}>
       <button class="primary large create-btn" onclick={() => showModal = true}>
         <div class="btn-content">
           <svg width="24" height="24" viewBox="0 0 24 24" class="icon">
             <path d={mdiIcons.mdiPlus} />
           </svg>
           <span>Craft New Interface</span>
         </div>
        <div class="btn-shine"></div>
      </button>
    </section>

    {#if showModal}
      <div class="modal-backdrop" onclick={() => showModal = false} transition:fade={{ duration: 200 }}>
        <div 
          class="modal" 
          onclick={(e) => e.stopPropagation()}
          in:fly={{ y: 20, duration: 400, easing: cubicOut }}
        >
          <div class="modal-header">
            <h2>New Project</h2>
            <button class="close-icon" onclick={() => showModal = false}>&times;</button>
          </div>
          
          <div class="form-grid">
            <div class="field">
              <label for="name">Project Name</label>
              <input
                id="name"
                type="text"
                placeholder="Living Room Dashboard"
                bind:value={newProjectName}
                autofocus
              />
            </div>

            <div class="field">
              <label>Display</label>
              <p class="hardware-info">Guition ESP32-S3-4848S040 &mdash; 480 &times; 480</p>
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn-text" onclick={() => showModal = false}>Cancel</button>
            <button class="primary" onclick={createProject} disabled={!newProjectName.trim()}>
              Initialize Blueprint
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if showSetupWizard && newlyCreatedProject}
      <DeviceSetupWizard
        projectId={newlyCreatedProject.id}
        projectName={newlyCreatedProject.name}
        onClose={handleWizardClose}
        onSkip={handleWizardSkip}
      />
    {/if}

    <section class="ha-settings" in:fade={{ delay: 300, duration: 800 }}>
      <div class="section-header">
        <h2>Home Assistant</h2>
        {#if homeAssistantStore.isLoaded}
          <span class="status status-connected">
            <svg width="8" height="8" viewBox="0 0 24 24" class="icon">
              <circle cx="12" cy="12" r="10" />
            </svg>
            Connected
          </span>
        {:else}
          <span class="status status-disconnected">Not configured</span>
        {/if}
      </div>

      <div class="ha-card">
        {#if homeAssistantStore.isLoaded}
          <div class="ha-info">
            <div class="ha-stats">
              <div class="stat">
                <span class="stat-value">{homeAssistantStore.entities.length}</span>
                <span class="stat-label">Entities</span>
              </div>
              <div class="stat">
                <span class="stat-value">{homeAssistantStore.devices.length}</span>
                <span class="stat-label">Devices</span>
              </div>
              <div class="stat">
                <span class="stat-value">{homeAssistantStore.domains.length}</span>
                <span class="stat-label">Domains</span>
              </div>
              <div class="stat">
                <span class="stat-value">{homeAssistantStore.areas.length}</span>
                <span class="stat-label">Areas</span>
              </div>
            </div>
            {#if homeAssistantStore.generatedAt}
              <p class="ha-meta">
                Last updated: {new Date(homeAssistantStore.generatedAt).toLocaleString()}
              </p>
            {/if}
          </div>
          <div class="ha-actions">
            <button class="btn-outline" onclick={() => haFileInput.click()}>
              <svg width="16" height="16" viewBox="0 0 24 24" class="icon">
                <path d={mdiIcons.mdiRefresh} />
              </svg>
              Update
            </button>
            <button class="btn-outline danger" onclick={clearHADump}>
              <svg width="16" height="16" viewBox="0 0 24 24" class="icon">
                <path d={mdiIcons.mdiClose} />
              </svg>
              Remove
            </button>
          </div>
        {:else}
          <div class="ha-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" class="icon ha-icon">
              <path d={mdiIcons.mdiHomeAssistant} />
            </svg>
            <p>Import your Home Assistant entity dump to enable entity binding and autocomplete.</p>
            <button class="primary" onclick={() => haFileInput.click()}>
              <svg width="16" height="16" viewBox="0 0 24 24" class="icon">
                <path d={mdiIcons.mdiUpload} />
              </svg>
              Import JSON Dump
            </button>
          </div>
        {/if}

        {#if haImportError}
          <div class="ha-message error" transition:fade={{ duration: 200 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" class="icon">
              <path d={mdiIcons.mdiAlertCircle} />
            </svg>
            {haImportError}
          </div>
        {/if}

        {#if haImportSuccess}
          <div class="ha-message success" transition:fade={{ duration: 200 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" class="icon">
              <path d={mdiIcons.mdiCheckCircle} />
            </svg>
            Successfully imported Home Assistant data
          </div>
        {/if}
      </div>

      <input
        type="file"
        accept=".json"
        bind:this={haFileInput}
        onchange={handleHAFileSelect}
        style="display: none"
      />
    </section>

    <section class="project-list" in:fade={{ delay: 400, duration: 800 }}>
      <div class="section-header">
        <h2>Your Blueprints</h2>
        <span class="count">{projects.length} saved</span>
      </div>
      
      {#if projects.length === 0}
        <div class="empty-state" in:scale={{ start: 0.95, delay: 600 }}>
          <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" class="icon">
              <path d={mdiIcons.mdiViewGrid} />
            </svg>
          </div>
          <p>The canvas is empty. Start your first display design today.</p>
        </div>
      {:else}
        <div class="grid">
          {#each projects as project, i}
            <div in:fly={{ y: 20, delay: 500 + (i * 50), duration: 500 }}>
              <a href="/project/{project.id}" class="project-card">
                <div class="project-info">
                  <h3>{project.name}</h3>
                  <div class="meta">
                    <span class="date">
                      <svg width="12" height="12" viewBox="0 0 24 24" class="icon">
                        <path d={mdiIcons.mdiClock} />
                      </svg>
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div class="card-actions">
                  <button class="delete-btn" onclick={(e) => deleteProject(project.id, e)} title="Delete Project">
                    <svg width="18" height="18" viewBox="0 0 24 24" class="icon">
                      <path d={mdiIcons.mdiDelete} />
                    </svg>
                  </button>
                  <div class="arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" class="icon">
                      <path d={mdiIcons.mdiChevronRight} />
                    </svg>
                  </div>
                </div>
              </a>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  </main>
</div>

<style>
  .project-selector {
    position: relative;
    max-width: 1000px;
    margin: 0 auto;
    padding: 4rem var(--spacing-xl);
    min-height: 100vh;
  }

  .glow-bg {
    position: fixed;
    top: -10%;
    left: 50%;
    transform: translateX(-50%);
    width: 80%;
    height: 40%;
    background: radial-gradient(circle, rgba(74, 158, 254, 0.08) 0%, rgba(0,0,0,0) 70%);
    pointer-events: none;
    z-index: -1;
  }

  header {
    text-align: center;
    margin-bottom: 4rem;
  }

  h1 {
    font-size: 3.5rem;
    font-weight: 800;
    margin-bottom: var(--spacing-sm);
    background: linear-gradient(to right, #fff, var(--color-accent), #4facfe);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.02em;
  }

  header p {
    color: var(--color-text-secondary);
    font-size: 1.25rem;
    font-weight: 400;
    opacity: 0.8;
  }

  .actions {
    display: flex;
    justify-content: center;
    margin-bottom: 5rem;
  }

  .create-btn {
    position: relative;
    padding: 0;
    overflow: hidden;
    border-radius: var(--radius-lg);
    border: none;
    box-shadow: 0 10px 30px rgba(74, 158, 254, 0.2);
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .btn-content {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: 1.25rem 2.5rem;
    font-size: 1.25rem;
    font-weight: 600;
    z-index: 1;
    position: relative;
  }

  .create-btn:hover {
    transform: translateY(-4px);
    box-shadow: 0 15px 40px rgba(74, 158, 254, 0.3);
  }

  .create-btn:active {
    transform: translateY(-1px);
  }

  .btn-shine {
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      120deg,
      transparent,
      rgba(255, 255, 255, 0.2),
      transparent
    );
    transition: all 0.6s;
  }

  .create-btn:hover .btn-shine {
    left: 100%;
  }

  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(8px);
  }

  .modal {
    background: #121212;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1.5rem;
    padding: 2.5rem;
    width: 90%;
    max-width: 550px;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .modal h2 {
    font-size: 1.75rem;
    margin: 0;
    font-weight: 700;
    color: #fff;
  }

  .close-icon {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 2rem;
    cursor: pointer;
    line-height: 1;
    padding: 0;
    transition: color 0.2s;
  }

  .close-icon:hover {
    color: #fff;
  }

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .field label {
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-secondary);
  }

  .field input, .field select {
    padding: 1rem;
    background: #1e1e1e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-md);
    color: #fff;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .field input:focus, .field select:focus {
    border-color: var(--color-accent);
    background: #252525;
    outline: none;
    box-shadow: 0 0 0 3px rgba(74, 158, 254, 0.1);
  }

  .hardware-info {
    padding: 1rem;
    background: #1e1e1e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font-size: 0.95rem;
    margin: 0;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1.5rem;
    margin-top: 2.5rem;
  }

  .btn-text {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-weight: 600;
    cursor: pointer;
    transition: color 0.2s;
  }

  .btn-text:hover {
    color: #fff;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 2rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    padding-bottom: 1rem;
  }

  .section-header h2 {
    font-size: 1.5rem;
    margin: 0;
    font-weight: 700;
    color: #fff;
  }

  .count {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    font-weight: 500;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .project-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.75rem;
    background: #161616;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 1.25rem;
    text-decoration: none;
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
    position: relative;
    overflow: hidden;
  }

  .project-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: var(--color-accent);
    opacity: 0;
    transition: opacity 0.3s;
  }

  .project-card:hover {
    background: #1c1c1c;
    border-color: rgba(74, 158, 254, 0.3);
    transform: translateX(4px);
  }

  .project-card:hover::before {
    opacity: 1;
  }

  .project-info h3 {
    margin: 0 0 0.5rem 0;
    color: #fff;
    font-size: 1.2rem;
    font-weight: 600;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .date {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .delete-btn {
    background: rgba(255, 82, 82, 0.05);
    border: 1px solid rgba(255, 82, 82, 0.1);
    color: #ff5252;
    padding: 0.6rem;
    border-radius: 0.75rem;
    opacity: 0;
    transform: scale(0.9);
    transition: all 0.2s;
  }

  .project-card:hover .delete-btn {
    opacity: 1;
    transform: scale(1);
  }

  .delete-btn:hover {
    background: #ff5252;
    color: #fff;
  }

  .arrow {
    color: var(--color-accent);
    opacity: 0.3;
    transition: all 0.3s;
    transform: translateX(-5px);
  }

  .project-card:hover .arrow {
    opacity: 1;
    transform: translateX(0);
  }

  .empty-state {
    text-align: center;
    padding: 5rem 2rem;
    color: var(--color-text-muted);
    background: #0f0f0f;
    border-radius: 1.5rem;
    border: 1px dashed rgba(255, 255, 255, 0.1);
  }

  .empty-icon {
    margin-bottom: 1.5rem;
    opacity: 0.5;
  }

  .empty-state p {
    font-size: 1.1rem;
    max-width: 300px;
    margin: 0 auto;
  }

  .icon {
    fill: currentColor;
    stroke: none;
  }

  /* Home Assistant Section */
  .ha-settings {
    margin-bottom: 4rem;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .status-connected {
    color: #4ade80;
  }

  .status-disconnected {
    color: var(--color-text-muted);
  }

  .ha-card {
    background: #161616;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 1.25rem;
    padding: 1.75rem;
  }

  .ha-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .ha-stats {
    display: flex;
    gap: 2rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #fff;
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .ha-meta {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin: 1rem 0 0 0;
  }

  .ha-actions {
    display: flex;
    gap: 0.75rem;
  }

  .btn-outline {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-outline:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.25);
    color: #fff;
  }

  .btn-outline.danger:hover {
    background: rgba(255, 82, 82, 0.1);
    border-color: rgba(255, 82, 82, 0.3);
    color: #ff5252;
  }

  .ha-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 2rem;
    gap: 1rem;
  }

  .ha-icon {
    color: var(--color-accent);
    opacity: 0.6;
  }

  .ha-empty p {
    color: var(--color-text-muted);
    max-width: 400px;
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .ha-empty button {
    margin-top: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ha-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    font-weight: 500;
  }

  .ha-message.error {
    background: rgba(255, 82, 82, 0.1);
    border: 1px solid rgba(255, 82, 82, 0.2);
    color: #ff5252;
  }

  .ha-message.success {
    background: rgba(74, 222, 128, 0.1);
    border: 1px solid rgba(74, 222, 128, 0.2);
    color: #4ade80;
  }
</style>
