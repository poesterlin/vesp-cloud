<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
</script>

{#if projectStore.currentDetailView && projectStore.display}
  <h3>Detail View Properties</h3>
  <div class="property-section">
    <div class="field">
      <span class="field-label">Title</span>
      <input
        type="text"
        value={projectStore.currentDetailView.title}
        oninput={(e) =>
          projectStore.updateDetailView(projectStore.currentDetailView!.id, {
            title: e.currentTarget.value,
          })}
      />
    </div>
    <div class="field">
      <span class="field-label">Height</span>
      <input
        type="number"
        min={projectStore.display.height}
        step={10}
        value={projectStore.currentDetailView.height}
        oninput={(e) =>
          projectStore.updateDetailView(projectStore.currentDetailView!.id, {
            height:
              parseInt(e.currentTarget.value) || projectStore.display!.height,
          })}
      />
    </div>
  </div>
{/if}
