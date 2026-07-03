<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { homeAssistantStore } from "$lib/stores/homeassistant.svelte";
  import { onMount } from "svelte";
  import { fade, fly, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import * as mdiIcons from "@mdi/js";
  import { dev } from "$app/environment";
  import { goto } from "$app/navigation";
  import OnboardingCard from "$lib/components/OnboardingCard.svelte";
  import CreateProjectModal from "$lib/components/CreateProjectModal.svelte";
  import type { CreateProjectConfig } from "$lib/components/CreateProjectModal.svelte";

  let { data } = $props();
  let projects = $state<{ id: string; name: string; updatedAt: string }[]>([]);

  $effect(() => {
    projects = data.projects ?? [];
  });
  let showModal = $state(false);

  // Onboarding state
  let showOnboarding = $state(false);

  $effect(() => {
    if (!dev && projects.length > 0) {
      showOnboarding = false;
    }
  });

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
        setTimeout(() => (haImportSuccess = false), 3000);
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
    if (dev) {
      showOnboarding = true;
    } else {
      const dismissed = localStorage.getItem("onboarding-dismissed") === "1";
      if (!dismissed && projects.length === 0) {
        showOnboarding = true;
      }
    }

    const localProjects = projectStore.getLocalStorageProjects();
    if (localProjects.length > 0) {
      for (const lp of localProjects) {
        const data = projectStore.getLocalProjectData(lp.id);
        if (data) {
          try {
            await fetch("/api/projects", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: data.name, data }),
            });
          } catch (e) {
            console.error("Migration failed for", lp.name, e);
          }
        }
      }
      projectStore.clearLocalStorage();
      projects = await projectStore.listProjects();
    }
  });

  async function handleCreateProject(config: CreateProjectConfig) {
    const newProject = await projectStore.createNewProject(config.name, {
      display: { width: 480, height: 480 },
    });

    projectStore.updateProject({
      notificationOverlay: config.notificationOverlay,
      timezone: config.timezone,
    });

    projects = await projectStore.listProjects();
    showModal = false;

    if (newProject) {
      await goto(`/project/${newProject.id}`);
    }
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
    {#if data.user}
      <div class="user-bar">
        <span class="user-name">{data.user.username}</span>
        <a href="/credits" class="user-link">
          <svg width="16" height="16" viewBox="0 0 24 24" class="icon">
            <path d={mdiIcons.mdiCashMultiple} />
          </svg>
          Credits
        </a>
        <a href="/account" class="user-link">
          <svg width="16" height="16" viewBox="0 0 24 24" class="icon">
            <path d={mdiIcons.mdiAccount} />
          </svg>
          Profile
        </a>
        <a href="/feedback" class="user-link">
          <svg width="16" height="16" viewBox="0 0 24 24" class="icon">
            <path d={mdiIcons.mdiMessageText} />
          </svg>
          Feedback
        </a>
        <form action="/logout" method="post" class="logout-form">
          <button type="submit" class="user-link logout-link">Logout</button>
        </form>
      </div>
    {/if}
    <h1>ESPHome Designer</h1>
    <p>The visual architect for your smart home displays</p>
  </header>

  <main>
    {#if showModal}
      <CreateProjectModal
        onClose={() => (showModal = false)}
        onCreate={handleCreateProject}
      />
    {/if}

    {#if showOnboarding}
      <OnboardingCard onDismiss={() => (showOnboarding = false)} />
    {/if}

    <section class="project-list" in:fade={{ delay: 400, duration: 800 }}>
      <div class="section-header">
        <h2>Your Project</h2>
        <div class="section-header-actions">
          <span class="count">{projects.length} saved</span>
          <button class="primary create-btn" onclick={() => (showModal = true)}>
            <div class="btn-content">
              <svg width="18" height="18" viewBox="0 0 24 24" class="icon">
                <path d={mdiIcons.mdiPlus} />
              </svg>
              <span>New Project</span>
            </div>
            <div class="btn-shine"></div>
          </button>
        </div>
      </div>

      {#if projects.length === 0}
        <div class="empty-state" in:scale={{ start: 0.95, delay: 600 }}>
          <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" class="icon">
              <path d={mdiIcons.mdiViewGrid} />
            </svg>
          </div>
          <p>You do not have any projects jet. Setup your first display.</p>
        </div>
      {:else}
        <div class="grid">
          {#each projects as project, i}
            <div in:fly={{ y: 20, delay: 500 + i * 50, duration: 500 }}>
              <a href="/project/{project.id}" class="project-card">
                <div class="project-info">
                  <h3>{project.name}</h3>
                  <div class="meta">
                    <span class="date">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        class="icon"
                      >
                        <path d={mdiIcons.mdiClock} />
                      </svg>
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div class="card-actions">
                  <button
                    class="delete-btn"
                    onclick={(e) => deleteProject(project.id, e)}
                    title="Delete Project"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      class="icon"
                    >
                      <path d={mdiIcons.mdiDelete} />
                    </svg>
                  </button>
                  <div class="arrow">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      class="icon"
                    >
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

    <section class="ha-settings" in:fade={{ delay: 300, duration: 800 }}>
      <div class="section-header">
        <h2>Home Assistant</h2>
        {#if !homeAssistantStore.isLoaded}
          <span class="status status-disconnected">Not configured</span>
        {/if}
      </div>

      <div class="ha-card">
        {#if homeAssistantStore.isLoaded}
          <div class="ha-info">
            <div class="ha-stats">
              <div class="stat">
                <span class="stat-value"
                  >{homeAssistantStore.entities.length}</span
                >
                <span class="stat-label">Entities</span>
              </div>
              <div class="stat">
                <span class="stat-value"
                  >{homeAssistantStore.devices.length}</span
                >
                <span class="stat-label">Devices</span>
              </div>
              <div class="stat">
                <span class="stat-value"
                  >{homeAssistantStore.domains.length}</span
                >
                <span class="stat-label">Domains</span>
              </div>
              <div class="stat">
                <span class="stat-value">{homeAssistantStore.areas.length}</span
                >
                <span class="stat-label">Areas</span>
              </div>
            </div>
            {#if homeAssistantStore.generatedAt}
              <p class="ha-meta">
                Last updated: {new Date(
                  homeAssistantStore.generatedAt,
                ).toLocaleString()}
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
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              class="icon ha-icon"
            >
              <path d={mdiIcons.mdiHomeAssistant} />
            </svg>
            <p>
              Import your Home Assistant entity dump to enable entity binding
              and autocomplete. Install our HACS integration for the easiest
              setup.
            </p>
            <ol class="hacs-steps">
              <li>
                <span class="step-badge">1</span>
                Open HACS → <strong>Integrations → Custom repositories</strong>
              </li>
              <li>
                <span class="step-badge">2</span>
                Add <code>https://github.com/poesterlin/home-display</code> as an
                <strong>Integration</strong> repository
              </li>
              <li>
                <span class="step-badge">3</span>
                Install <strong>ESPHome Display Notifications &amp; Data Bridge</strong>
                and restart Home Assistant
              </li>
              <li>
                <span class="step-badge">4</span>
                Use the integration's <strong>Download Metadata File</strong> and import it here
              </li>
            </ol>
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
    color: var(--color-accent);
    letter-spacing: -0.02em;
  }

  header p {
    color: var(--color-text-secondary);
    font-size: 1.25rem;
    font-weight: 400;
    opacity: 0.8;
  }

  .user-bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .user-name {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
  }

  .user-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    line-height: 1;
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: 0.85rem;
    padding: 0.35rem 0.75rem;
    border-radius: 0.5rem;
    transition: all var(--transition-fast);
  }

  .user-link:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.06);
  }

  .logout-link {
    background: none;
    border: none;
    cursor: pointer;
  }

  .logout-form {
    display: inline-flex;
    align-items: center;
    margin: 0;
    padding: 0;
  }

  .create-btn {
    position: relative;
    padding: 0;
    overflow: hidden;
    border-radius: var(--radius-lg);
    border: none;
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .btn-content {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    z-index: 1;
    position: relative;
  }

  .btn-shine {
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.05);
    transition: all 0.3s;
  }

  .create-btn:hover .btn-shine {
    left: 100%;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 2rem;
  }

  .section-header h2 {
    font-size: 1.5rem;
    margin: 0;
    font-weight: 700;
    color: #fff;
  }

  .section-header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
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
    display: flex;
    justify-content: center;
    margin-bottom: 1.5rem;
    opacity: 0.5;
  }

  .empty-state p {
    font-size: 1.1rem;
    max-width: 300px;
    margin: 0 auto;
  }

  .icon {
    display: block;
    flex-shrink: 0;
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

  .hacs-steps {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    text-align: left;
    max-width: 420px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .hacs-steps li {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .hacs-steps li strong {
    color: #fff;
    font-weight: 600;
  }

  .hacs-steps li code {
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 0.75rem;
    color: var(--color-accent);
    background: rgba(74, 158, 254, 0.1);
    padding: 0.1rem 0.3rem;
    border-radius: 0.3rem;
    word-break: break-all;
  }

  .step-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(74, 158, 254, 0.15);
    color: var(--color-accent);
    font-size: 0.7rem;
    font-weight: 700;
    flex-shrink: 0;
    margin-top: 0.05rem;
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
