<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { onMount } from "svelte";
  import type { DisplayConfig } from "@esphome-designer/schema";
  import { fade, fly, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  
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

  onMount(() => {
    projects = projectStore.listProjects();
  });

  function createProject() {
    if (!newProjectName.trim()) return;
    
    const config: ProjectConfig = {
      display: {
        width: displayWidth,
        height: displayHeight,
        platform: displayPlatform
      }
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
  <div class="glow-bg"></div>
  
  <header in:fly={{ y: -20, duration: 800, easing: cubicOut }}>
    <h1>ESPHome Designer</h1>
    <p>The visual architect for your smart home displays</p>
  </header>

  <main>
    <section class="actions" in:fade={{ delay: 200, duration: 800 }}>
      <button class="primary large create-btn" onclick={() => showModal = true}>
        <div class="btn-content">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
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

            <div class="field-group">
              <div class="field">
                <label for="width">Width (px)</label>
                <input id="width" type="number" bind:value={displayWidth} />
              </div>
              <div class="field">
                <label for="height">Height (px)</label>
                <input id="height" type="number" bind:value={displayHeight} />
              </div>
            </div>

            <div class="field">
              <label for="platform">Hardware Platform</label>
              <div class="select-wrapper">
                <select id="platform" bind:value={displayPlatform}>
                  <option value="ili9xxx">ILI9xxx (Common 2.4", 2.8", 3.5" TFT)</option>
                  <option value="st7789">ST7789 (1.3", 2.0" IPS screens)</option>
                  <option value="ssd1306">SSD1306 (Small 0.96" OLEDs)</option>
                  <option value="waveshare_epaper">Waveshare (E-Ink / E-Paper)</option>
                </select>
                <svg class="select-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
              <p class="field-hint">Identify your controller chip from your display's back PCB or datasheet.</p>
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

    <section class="project-list" in:fade={{ delay: 400, duration: 800 }}>
      <div class="section-header">
        <h2>Your Blueprints</h2>
        <span class="count">{projects.length} saved</span>
      </div>
      
      {#if projects.length === 0}
        <div class="empty-state" in:scale={{ start: 0.95, delay: 600 }}>
          <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
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
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div class="card-actions">
                  <button class="delete-btn" onclick={(e) => deleteProject(project.id, e)} title="Delete Project">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                    </svg>
                  </button>
                  <div class="arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
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

  .field-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
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

  .select-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .select-wrapper select {
    width: 100%;
    appearance: none;
  }

  .select-arrow {
    position: absolute;
    right: 1rem;
    pointer-events: none;
    opacity: 0.5;
  }

  .field-hint {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.4;
    font-style: italic;
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
</style>
