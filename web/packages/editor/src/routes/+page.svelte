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
  import logo1024 from "@vesp-cloud/assets/logo-1024x1024.webp";
  import { track } from "$lib/analytics";

  let { data } = $props();
  type ProjectSummary = {
    id: string;
    name: string;
    updatedAt: string;
    deployment?: {
      status: string;
      published: boolean;
      createdAt: string;
    } | null;
  };

  let projects = $state<ProjectSummary[]>([]);

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
        track("ha_metadata_imported", { outcome: "success" });
        setTimeout(() => (haImportSuccess = false), 3000);
      } else {
        haImportError = "Invalid HomeAssistant dump format";
        track("ha_metadata_imported", { outcome: "invalid" });
      }
    } catch {
      haImportError = "Failed to read file";
      track("ha_metadata_imported", { outcome: "read_error" });
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
      track("project_created", {
        notification_overlay: Boolean(config.notificationOverlay),
        timezone_configured: Boolean(config.timezone),
      });
      await goto(`/project/${newProject.id}`);
    }
  }

  async function deleteProject(id: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (confirm("Are you sure you want to delete this project?")) {
      await projectStore.deleteProject(id);
      projects = projects.filter((project) => project.id !== id);
    }
  }

  function deploymentState(project: ProjectSummary) {
    const deployment = project.deployment;
    if (!deployment) return { label: "Not built", tone: "none" } as const;
    if (["pending", "queued", "running"].includes(deployment.status)) {
      return { label: "Building", tone: "building" } as const;
    }
    if (deployment.status === "failed") {
      return { label: "Build failed", tone: "failed" } as const;
    }
    if (deployment.status === "completed" && deployment.published) {
      return { label: "Deployed", tone: "live" } as const;
    }
    if (deployment.status === "completed") {
      return { label: "Ready to deploy", tone: "ready" } as const;
    }
    return { label: deployment.status, tone: "none" } as const;
  }

</script>

<div class="project-selector">
  <header in:fly={{ y: -20, duration: 800, easing: cubicOut }}>
    {#if data.user}
      <div class="user-bar">
        <span class="user-name">{data.user.username}</span>
        <a href="/credits" class="user-link">
          <svg width="16" height="16" viewBox="0 0 24 24" class="icon user-link-icon">
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
        <a href="https://docs.vesp.cloud" target="_blank" class="user-link">
          <svg width="16" height="16" viewBox="0 0 24 24" class="icon">
            <path d={mdiIcons.mdiBookOpenPageVariant} />
          </svg>
          Docs
        </a>
        <form action="/logout" method="post" class="logout-form">
          <button type="submit" class="user-link logout-link">Logout</button>
        </form>
      </div>
    {/if}
    <div class="brand-lockup">
      <img src={logo1024} alt="vESP.cloud" class="brand-mark" />
      <div class="brand-copy">
        <h1>All the control<br /><span>Affordable hardware</span></h1>
        <p>Design a Home Assistant display that runs directly on an ESP32.</p>
      </div>
    </div>
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
        <div class="section-title">
          <span class="section-kicker">Workspace</span>
          <h2>Your Projects</h2>
        </div>
        <div class="section-header-actions">
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
          <p>You do not have any projects yet. Set up your first display.</p>
        </div>
      {:else}
        <div class="grid">
          {#each projects as project, i}
            {@const deployment = deploymentState(project)}
            <div in:fly={{ y: 20, delay: 500 + i * 50, duration: 500 }}>
              <article class="project-card">
                <a href="/project/{project.id}" class="project-open" aria-label="Open {project.name} in the editor">
                  <div class="project-icon" aria-hidden="true">
                    <svg width="26" height="26" viewBox="0 0 24 24" class="icon">
                      <path d={mdiIcons.mdiMonitorScreenshot} />
                    </svg>
                  </div>
                  <div class="project-info">
                    <h3>{project.name}</h3>
                    <span class="date">
                      <svg width="12" height="12" viewBox="0 0 24 24" class="icon">
                        <path d={mdiIcons.mdiClock} />
                      </svg>
                      Edited {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div class="arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" class="icon">
                      <path d={mdiIcons.mdiChevronRight} />
                    </svg>
                  </div>
                </a>
                <div class="deployment-row">
                  <span class="deployment-state {deployment.tone}">
                    <span class="status-dot"></span>
                    {deployment.label}
                  </span>
                  <div class="card-actions">
                    <a class="secondary-action" href="/project/{project.id}/deploy">
                      <svg width="15" height="15" viewBox="0 0 24 24" class="icon">
                        <path d={mdiIcons.mdiRocketLaunchOutline} />
                      </svg>
                      Deploy
                    </a>
                    <button
                      class="secondary-action delete-btn"
                      onclick={(e) => deleteProject(project.id, e)}
                      aria-label="Delete {project.name}"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" class="icon">
                        <path d={mdiIcons.mdiDeleteOutline} />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <section class="ha-settings" in:fade={{ delay: 300, duration: 800 }}>
      <div class="section-header">
        <div class="section-title">
          <span class="section-kicker">Data source</span>
          <h2>Home Assistant</h2>
          <p>Entity metadata enables binding, autocomplete, and realistic previews.</p>
        </div>
        {#if homeAssistantStore.isLoaded}
          <span class="status status-connected">Metadata loaded</span>
        {:else}
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
                Add <code>https://github.com/poesterlin/ha-metadata-exporter</code> as an
                <strong>Integration</strong> repository
              </li>
              <li>
                <span class="step-badge">3</span>
                Install <strong>HA Metadata Exporter</strong>
                and restart Home Assistant
              </li>
              <li>
                <span class="step-badge">4</span>
                Use the integration's <strong>Download metadata</strong> action and import it here
              </li>
            </ol>
            <div class="dump-actions">
              <button class="primary" onclick={() => haFileInput.click()}>
                <svg width="16" height="16" viewBox="0 0 24 24" class="icon">
                  <path d={mdiIcons.mdiUpload} />
                </svg>
                Import JSON Dump
              </button>
              <a
                class="dump-info-link"
                href="/home-assistant-entity-export"
                aria-label="Learn about Home Assistant entity exports"
                title="Learn about Home Assistant entity exports"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d={mdiIcons.mdiInformationOutline} />
                </svg>
                About entity dumps
              </a>
            </div>
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
    padding: 2rem var(--spacing-xl) 4rem;
    min-height: 100vh;
  }

  header {
    margin-bottom: 3rem;
  }

  h1 {
    font-size: clamp(2.35rem, 5vw, 4rem);
    font-weight: 800;
    margin-bottom: var(--spacing-sm);
    color: #fff;
    letter-spacing: -0.045em;
    line-height: 0.98;
  }

  h1 span {
    color: #35c8d0;
  }

  header p {
    color: var(--color-text-secondary);
    font-size: 1.25rem;
    font-weight: 400;
    opacity: 0.8;
  }

  .brand-lockup {
    display: grid;
    grid-template-columns: 168px 1fr;
    align-items: center;
    gap: 2.5rem;
  }

  .brand-mark {
    width: 168px;
    aspect-ratio: 1;
    border-radius: 12px;
    object-fit: cover;
    border: 1px solid rgba(239, 43, 112, 0.35);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.48);
  }

  .brand-copy {
    text-align: left;
  }

  .eyebrow {
    display: block;
    margin-bottom: 0.8rem;
    color: #f1b829;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
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

  .user-link-icon {
    transform: translateY(-2px);
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
    background: #53c4ca;
    color: #071014;
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
    display: none;
  }

  .create-btn:hover {
    background: #70d2d7;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 2rem;
    padding: 0 0 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .section-header h2 {
    font-size: 1.5rem;
    margin: 0;
    font-weight: 700;
    color: #fff;
  }

  .section-title {
    min-width: 0;
  }

  .section-title p {
    margin-top: 0.4rem;
    color: #909090;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .section-kicker {
    display: block;
    margin-bottom: 0.35rem;
    color: #53c4ca;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .section-header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .count {
    font-size: 0.9rem;
    color: #909090;
    font-weight: 500;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.25rem;
    padding: 1.25rem 0 0;
  }

  .project-list,
  .ha-settings {
    background: transparent;
  }

  .ha-settings {
    overflow: hidden;
    background: #161616;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 0.9rem;
  }

  .ha-settings .section-header {
    padding: 1.5rem;
  }

  .project-list {
    margin-bottom: 3.5rem;
  }

  .project-card {
    display: flex;
    flex-direction: column;
    background: #202526;
    border-top: 3px solid #35c8d0;
    border-radius: 0.65rem;
    text-decoration: none;
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
    position: relative;
    min-height: 190px;
    overflow: hidden;
    box-shadow: 0 14px 36px rgba(0, 0, 0, 0.28);
    corner-shape: bevel;
  }

  .project-card::before {
    content: "";
    position: absolute;
    z-index: 1;
    top: -3px;
    left: 1.25rem;
    width: 76px;
    height: 3px;
    background: #ed2f72;
  }

  .project-card:hover {
    border-color: #526164;
    border-top-color: #35c8d0;
    box-shadow: 0 20px 46px rgba(0, 0, 0, 0.4);
  }

  .project-open {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) auto;
    align-items: center;
    gap: 1rem;
    width: 100%;
    padding: 1.5rem 1.4rem 1.25rem;
    color: inherit;
    text-decoration: none;
    flex: 1;
  }

  .project-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    color: #35c8d0;
    background: #172b2d;
    border: 1px solid #28676b;
    border-radius: 0.4rem;
  }

  .project-info h3 {
    margin: 0 0 0.5rem 0;
    color: #fff;
    font-size: 1.3rem;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    font-size: 0.9rem;
    color: #909090;
  }

  .deployment-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    margin-top: auto;
    padding: 0.85rem 1.4rem;
    background: rgba(5, 12, 13, 0.28);
    border-top: 1px solid #343b3d;
  }

  .deployment-state {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    color: #909090;
    font-size: 0.82rem;
    font-weight: 600;
  }

  .status-dot {
    width: 7px;
    height: 7px;
    flex-shrink: 0;
    border-radius: 50%;
    background: currentColor;
  }

  .deployment-state.live { color: #65c98c; }
  .deployment-state.ready { color: #53c4ca; }
  .deployment-state.building { color: #f1b829; }
  .deployment-state.failed { color: #ff6b6b; }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .secondary-action {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.5rem;
    border: 0;
    border-radius: 0.4rem;
    background: transparent;
    color: #a7a7a7;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: color 0.2s, background 0.2s;
  }

  .secondary-action:hover,
  .secondary-action:focus-visible {
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
    outline: none;
  }

  .delete-btn:hover {
    background: rgba(255, 82, 82, 0.12);
    color: #ff7b7b;
  }

  .arrow {
    color: #ed2f72;
    opacity: 0.65;
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
    margin: 1.25rem 0 0;
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
    padding: 0.4rem 0.7rem;
    border: 1px solid currentColor;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 700;
  }

  .status-connected {
    color: #65c98c;
  }

  .status-disconnected {
    color: #888;
  }

  .ha-card {
    padding: 1.5rem;
  }

  .ha-info {
    display: block;
  }

  .ha-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(90px, 1fr));
    gap: 0;
    flex: 1;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
    padding: 0.35rem 1.25rem;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
  }

  .stat:first-child {
    padding-left: 0;
    border-left: 0;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #fff;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #909090;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .ha-meta {
    font-size: 0.88rem;
    color: #909090;
    margin: 0.85rem 0 0;
  }

  .ha-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.25rem;
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
    align-items: flex-start;
    text-align: left;
    padding: 1rem 0.5rem;
    gap: 1.25rem;
  }

  .ha-icon {
    color: #53c4ca;
    opacity: 0.6;
  }

  .ha-empty p {
    color: #aaa;
    max-width: 620px;
    margin: 0;
    font-size: 1rem;
    line-height: 1.6;
  }

  .dump-info-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: #8fa5aa;
    font-size: 0.82rem;
    text-decoration: none;
  }

  .dump-info-link svg { width: 17px; fill: currentColor; }
  .dump-info-link:hover { color: #53c4ca; }

  .dump-actions {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    flex-wrap: wrap;
  }

  .ha-empty .dump-actions button { margin-top: 0; }

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
    max-width: 680px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .hacs-steps li {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    font-size: 0.92rem;
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

  @media (max-width: 640px) {
    .project-selector {
      padding: 1rem var(--spacing-md) 3rem;
    }

    .brand-lockup {
      grid-template-columns: 88px 1fr;
      gap: 1.25rem;
    }

    .brand-mark {
      width: 88px;
      border-radius: 16px;
    }

    header p {
      font-size: 0.95rem;
    }

    .user-bar {
      overflow-x: auto;
      justify-content: flex-start;
    }

    .section-header {
      align-items: flex-start;
      flex-direction: column;
      gap: 1.25rem;
      padding: 0 0 1rem;
    }

    .ha-settings .section-header {
      padding: 1.25rem;
    }

    .section-header-actions {
      width: 100%;
      justify-content: space-between;
    }

    .grid,
    .ha-card {
      padding: 1rem 0 0;
    }

    .ha-card {
      padding: 1.25rem;
    }

    .grid {
      grid-template-columns: 1fr;
    }

    .ha-stats {
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem 0;
    }

    .stat:nth-child(odd) {
      padding-left: 0;
      border-left: 0;
    }

    .ha-actions {
      flex-wrap: wrap;
    }
  }
</style>
