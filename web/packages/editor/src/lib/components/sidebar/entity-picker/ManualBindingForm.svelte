<script lang="ts">
  import type { EntityBinding } from "@vesp-cloud/schema";

  let { binding, onConfirm, compact = false, allowAttribute = true }: {
    binding?: EntityBinding;
    onConfirm: (binding: EntityBinding) => void;
    compact?: boolean;
    allowAttribute?: boolean;
  } = $props();

  let entityId = $state("");
  let attribute = $state("");

  $effect(() => {
    entityId = binding?.entityId ?? "";
    attribute = binding?.attribute ?? "";
  });

  function confirm() {
    const id = entityId.trim();
    if (id) onConfirm({ entityId: id, attribute: allowAttribute ? attribute.trim() || undefined : undefined });
  }
</script>

<form class:compact onsubmit={(event) => { event.preventDefault(); confirm(); }}>
  <label>
    <span>Entity ID</span>
    <input bind:value={entityId} placeholder="light.living_room" autocomplete="off" />
  </label>
  {#if allowAttribute}
    <label>
      <span>Attribute <small>(optional)</small></span>
      <input bind:value={attribute} placeholder="brightness" autocomplete="off" />
    </label>
  {/if}
  <button type="submit" disabled={!entityId.trim()}>Use entity</button>
</form>

<style>
  form { display:grid; grid-template-columns:1fr 1fr auto; gap:10px; align-items:end; }
  form.compact { grid-template-columns:1fr; width:100%; gap:8px; }
  label { display:flex; flex-direction:column; gap:5px; color:#aeb8cc; font-size:11px; font-weight:600; }
  small { color:#6f7b91; font-weight:400; }
  input { width:100%; min-width:0; box-sizing:border-box; padding:9px 10px; color:#e8edf7; background:#171c27; border:1px solid #30394b; border-radius:6px; outline:none; }
  input:focus { border-color:#5c7cfa; }
  button { padding:9px 13px; border:0; border-radius:6px; color:white; background:#526ee8; cursor:pointer; white-space:nowrap; }
  form.compact button { justify-self:start; padding:6px 10px; border:1px solid #3b465c; color:#c6cede; background:#252c3a; font-size:11px; }
  form.compact button:not(:disabled):hover { border-color:#5c7cfa; color:white; }
  button:disabled { opacity:.45; cursor:not-allowed; }
  @media (max-width: 650px) { form, form.compact { grid-template-columns:1fr; } }
</style>
