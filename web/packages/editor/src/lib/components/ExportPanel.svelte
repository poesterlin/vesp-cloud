<script lang="ts">
  import DeployWizard from "$lib/components/DeployWizard.svelte";

  interface Props {
    onClose: () => void;
    onCompilingChange?: (isCompiling: boolean) => void;
  }

  let { onClose, onCompilingChange }: Props = $props();
</script>

<div class="modal-panel">
  <DeployWizard onClose={onClose} />
</div>

<style>
  .modal-panel {
    display: flex;
    flex-direction: column;
    background: var(--color-bg-primary);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }
</style>
