<script lang="ts">
  import type { ValidationError } from "$lib/codegen/validations";

  let { errors } = $props<{ errors: ValidationError[] }>();
</script>

{#if errors.length > 0}
  <div class="validation-errors">
    {#each errors as error}
      <div class="validation-error">
        <svg class="error-icon" width="14" height="14" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="11" fill="#f44336" />
          <path
            d="M12 7v6M12 15v2"
            stroke="white"
            stroke-width="2.5"
            stroke-linecap="round"
          />
        </svg>
        <span>{error.message}</span>
      </div>
    {/each}
  </div>
{/if}
