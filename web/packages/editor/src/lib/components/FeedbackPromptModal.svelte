<script lang="ts">
  import { applyAction, enhance } from "$app/forms";
  import { track } from "$lib/analytics";

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();
  let submitting = $state(false);
  let errorMessage = $state<string | null>(null);

  function handleSubmit() {
    submitting = true;
    errorMessage = null;

    return async ({ result }: { result: any }) => {
      submitting = false;
      if (result.type === "success") {
        track("feedback_submitted");
        onClose();
        return;
      }

      if (result.type === "failure") {
        errorMessage = result.data?.message ?? "Could not send feedback.";
      } else {
        await applyAction(result);
      }
    };
  }
</script>

<div class="modal-overlay" role="presentation" onclick={onClose}>
  <div
    class="modal-content"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby="feedback-prompt-title"
    onclick={(event: MouseEvent) => event.stopPropagation()}
  >
    <div class="modal-header">
      <div>
        <p class="eyebrow">Help shape vESP.cloud</p>
        <h2 id="feedback-prompt-title">How is the app working for you?</h2>
      </div>
      <button class="close-btn" type="button" onclick={onClose} aria-label="Close feedback prompt">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>

    <form method="POST" action="/feedback?/submit" use:enhance={handleSubmit}>
      <div class="modal-body">
        <p class="description">
          Your feedback helps us improve the editor and generated displays. A few words about what works or what is frustrating is enough.
        </p>
        {#if errorMessage}
          <p class="error" role="alert">{errorMessage}</p>
        {/if}
        <label for="feedback-message">Your feedback</label>
        <textarea
          id="feedback-message"
          name="message"
          rows="5"
          minlength="3"
          maxlength="2000"
          placeholder="What could be better?"
          required
          disabled={submitting}
        ></textarea>
        <p class="hint">You can attach screenshots later from the <a href="/feedback">full feedback page</a>.</p>
      </div>
      <div class="modal-footer">
        <button class="btn secondary" type="button" onclick={onClose} disabled={submitting}>Not now</button>
        <button class="btn primary" type="submit" disabled={submitting}>
          {submitting ? "Sending..." : "Send Feedback"}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 2100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.68);
    backdrop-filter: blur(4px);
  }

  .modal-content {
    width: min(480px, 100%);
    overflow: hidden;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-border);
  }

  .eyebrow {
    margin: 0 0 0.35rem;
    color: var(--color-accent);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 { margin: 0; color: var(--color-text-primary); font-size: 1.15rem; }

  .close-btn {
    border: 0;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 1.5rem;
    line-height: 1;
  }

  .modal-body { display: grid; gap: 0.7rem; padding: 1.5rem; }
  .description, .hint { margin: 0; color: var(--color-text-secondary); line-height: 1.5; }
  label { color: var(--color-text-primary); font-size: 0.88rem; font-weight: 600; }
  textarea {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0.75rem;
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font: inherit;
  }
  .hint { font-size: 0.8rem; }
  .hint a { color: var(--color-accent); }
  .error { margin: 0; color: #ff9d9d; font-size: 0.88rem; }
  .modal-footer { display: flex; justify-content: flex-end; gap: 0.6rem; padding: 0 1.5rem 1.5rem; }
  .btn { border: 0; border-radius: 8px; padding: 0.65rem 1rem; font: inherit; font-weight: 600; cursor: pointer; }
  .btn:disabled { cursor: not-allowed; opacity: 0.55; }
  .secondary { background: var(--color-bg-tertiary); color: var(--color-text-secondary); }
  .primary { background: var(--color-accent); color: white; }
</style>
