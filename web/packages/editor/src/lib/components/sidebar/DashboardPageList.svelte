<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import PageIndicator from "../canvas/PageIndicator.svelte";

  let editingId = $state<string | null>(null);
  let editValue = $state("");

  function startEditing(id: string, name: string) {
    editingId = id;
    editValue = name;
  }

  function handleKeydown(e: KeyboardEvent, id: string) {
    if (e.key === "Enter") {
      saveRename(id);
    } else if (e.key === "Escape") {
      editingId = null;
    }
  }

  function saveRename(id: string) {
    if (editValue.trim()) {
      projectStore.renameDashboardPage(id, editValue.trim());
    }
    editingId = null;
  }
</script>

<div class="list-container">
  <div class="header">
    <h3>DASHBOARD PAGES</h3>
    <button class="add-btn" onclick={() => projectStore.addDashboardPage()}
      >+</button
    >
  </div>

  <div class="items">
    {#each projectStore.dashboardPages as page, i}
      <div
        role="button"
        tabindex="0"
        onkeydown={() => {}}
        class="item"
        class:active={projectStore.currentDashboardPageId === page.id}
        onclick={() => projectStore.setDashboardPage(page.id)}
        ondblclick={() => startEditing(page.id, page.name)}
      >
        <div class="item-left">
          <div class="move-btns">
            <button
              class="move-btn"
              disabled={i === 0}
              onclick={(e) => {
                e.stopPropagation();
                projectStore.reorderDashboardPage(i, i - 1);
              }}
              title="Move Up">▲</button
            >
            <button
              class="move-btn"
              disabled={i === projectStore.dashboardPages.length - 1}
              onclick={(e) => {
                e.stopPropagation();
                projectStore.reorderDashboardPage(i, i + 1);
              }}
              title="Move Down">▼</button
            >
          </div>
          {#if editingId === page.id}
            <input
              type="text"
              class="edit-input"
              bind:value={editValue}
              onkeydown={(e) => handleKeydown(e, page.id)}
              onblur={() => saveRename(page.id)}
              autofocus
              onclick={(e) => e.stopPropagation()}
            />
          {:else}
            <span class="name">{page.name}</span>
          {/if}
        </div>
        <button
          class="delete-btn"
          onclick={(e) => {
            e.stopPropagation();
            projectStore.deleteDashboardPage(page.id);
          }}>×</button
        >
      </div>
    {/each}
  </div>

  <div class="indicator-preview">
    <PageIndicator
      count={projectStore.dashboardPages.length}
      currentIndex={projectStore.currentPageIndex}
      isStatic={true}
    />
  </div>
</div>

<style>
  .list-container {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h3 {
    font-size: 11px;
    color: #888;
    margin: 0;
    letter-spacing: 0.05em;
  }
  .add-btn {
    background: #4a9eff;
    border: none;
    color: white;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  }
  .items {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }
  .item:hover {
    background: #333;
  }
  .item.active {
    border-color: #4a9eff;
    background: rgba(74, 158, 255, 0.1);
  }
  .edit-input {
    background: #1a1a1a;
    border: 1px solid #4a9eff;
    color: white;
    font-size: 13px;
    padding: 2px 4px;
    border-radius: 2px;
    width: 140px;
    outline: none;
  }
  .item-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .move-btns {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .move-btn {
    background: none;
    border: none;
    color: #555;
    font-size: 8px;
    padding: 0;
    cursor: pointer;
    line-height: 1;
  }
  .move-btn:hover:not(:disabled) {
    color: #4a9eff;
  }
  .move-btn:disabled {
    opacity: 0.2;
    cursor: default;
  }
  .delete-btn {
    background: none;
    border: none;
    color: #666;
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
  }
  .delete-btn:hover {
    color: #ff4a4a;
  }
  .indicator-preview {
    position: relative;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-top: 1px solid #333;
    padding-top: 12px;
    margin-top: 4px;
  }
</style>
