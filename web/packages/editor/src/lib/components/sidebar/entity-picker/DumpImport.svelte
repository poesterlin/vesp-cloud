<script lang="ts">
  import { homeAssistantStore } from "$lib/stores/homeassistant.svelte";
  import { mdiAlertCircle, mdiCheckCircle, mdiUpload } from "@mdi/js";
  let input = $state<HTMLInputElement | null>(null);
  let active = $state(false);
  let message = $state<{ kind: "error" | "success"; text: string } | null>(null);

  async function importFile(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      message = { kind: "error", text: "Please choose a .json dump file" }; return;
    }
    try {
      message = homeAssistantStore.importFromJson(await file.text())
        ? { kind: "success", text: "Home Assistant dump imported" }
        : { kind: "error", text: "Invalid Home Assistant dump format" };
    } catch { message = { kind: "error", text: "Failed to read file" }; }
  }
</script>

<div class="importer">
  <div class:active class="dropzone" role="button" tabindex="0"
    ondragover={(e) => { e.preventDefault(); active = true; }}
    ondragleave={(e) => { e.preventDefault(); active = false; }}
    ondrop={(e) => { e.preventDefault(); active = false; importFile(e.dataTransfer?.files[0]); }}
    onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") input?.click(); }}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiUpload}></path></svg>
    <span>Or import a Home Assistant dump to browse entities</span>
    <button type="button" onclick={() => input?.click()}>Choose JSON file</button>
    <input bind:this={input} type="file" accept=".json" hidden onchange={(e) => { importFile(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }} />
  </div>
  {#if message}<p class={message.kind}><svg viewBox="0 0 24 24"><path d={message.kind === "error" ? mdiAlertCircle : mdiCheckCircle}></path></svg>{message.text}</p>{/if}
</div>

<style>
  .importer { padding:16px 20px 20px; }
  .dropzone { min-height:100px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:16px; border:1px dashed #394358; border-radius:8px; color:#8792a8; }
  .dropzone.active { border-color:#5c7cfa; background:rgba(92,124,250,.08); }
  svg { width:20px; height:20px; fill:currentColor; }
  button { color:#aebdfb; background:transparent; border:0; cursor:pointer; }
  p { display:flex; justify-content:center; align-items:center; gap:6px; margin:10px 0 0; font-size:12px; }
  p svg { width:14px; height:14px; } .error { color:#ff8b8b; } .success { color:#63d69b; }
</style>
