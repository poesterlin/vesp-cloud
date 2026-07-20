<script lang="ts">
  import * as mdiIcons from '@mdi/js';
  import type { PageProps } from './$types';
  import { track } from '$lib/analytics';

  let { data, form }: PageProps = $props();
  const entries = $derived(data?.entries ?? []);
  let trackedSuccess = $state(false);

  $effect(() => {
    if (form?.success && !trackedSuccess) {
      trackedSuccess = true;
      track('feedback_submitted');
    }
  });

  function formatDate(value: string) {
    return new Date(value).toLocaleString();
  }
</script>

<svelte:head>
  <title>vESP.cloud — Feedback</title>
</svelte:head>

<div class="feedback-page">
  <header class="feedback-header">
    <a href="/" class="back-link">
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path d={mdiIcons.mdiArrowLeft} />
      </svg>
      Back to Projects
    </a>
    <h1>Feedback</h1>
    <p>Send us ideas, bugs, or requests. A picture of the problem is often helpful.</p>
  </header>

  <section class="panel">
    <h2>Feedback</h2>
    {#if form?.message}
      <div class="notice error">{form.message}</div>
    {/if}
    {#if form?.success}
      <div class="notice success">Feedback sent successfully.</div>
    {/if}

    <form method="POST" action="?/submit" enctype="multipart/form-data" class="composer">
      <textarea
        id="message"
        name="message"
        rows="5"
        minlength="3"
        maxlength="2000"
        placeholder="What could be better?"
        required
      ></textarea>
      <label class="attachment-field" for="attachment">
        <span>Attach a picture <small>(optional, JPEG/PNG/WebP, up to 8 MB)</small></span>
        <input id="attachment" name="attachment" type="file" accept="image/jpeg,image/png,image/webp" />
      </label>
      <button type="submit" class="primary">Send Feedback</button>
    </form>
  </section>

  <section class="panel screenshot-help">
    <h2>Take a device screenshot in Home Assistant</h2>
    <p>The generated firmware exposes a <strong>Display Screenshot</strong> camera, but keeps it disabled by default.</p>
    <ol>
      <li>In Home Assistant, open <strong>Settings → Devices &amp; services</strong>.</li>
      <li>Open the <strong>ESPHome</strong> integration and select your display device.</li>
      <li>Expand the entities that are not shown and select <strong>Display Screenshot</strong>.</li>
      <li>Open its settings (cogwheel), turn on <strong>Enable</strong>, and select <strong>Update</strong>.</li>
      <li>Wait about 30 seconds, open the camera entity, and save its current image to attach here.</li>
    </ol>
    <p class="hint">The screenshot is captured on demand. Keeping the camera disabled when you do not need it avoids unnecessary device work.</p>
  </section>

  <section class="panel">
    <h2>Your Messages</h2>

    {#if entries.length === 0}
      <p class="empty">No feedback sent yet.</p>
    {:else}
      <div class="entries">
        {#each entries as entry (entry.id)}
          <article class="entry">
            <div class="meta">Sent {formatDate(entry.createdAt)}</div>
            <p class="message">{entry.message}</p>
            {#if entry.attachmentName}
              <a class="attachment" href={`/feedback/${entry.id}/attachment`} target="_blank" rel="noopener">
                <img src={`/feedback/${entry.id}/attachment`} alt={`Attachment: ${entry.attachmentName}`} loading="lazy" />
                <span>{entry.attachmentName}</span>
              </a>
            {/if}

            {#if entry.adminReply}
              <div class="reply">
                <div class="reply-meta">
                  Admin reply {entry.repliedAt ? formatDate(entry.repliedAt) : ''}
                </div>
                <p>{entry.adminReply}</p>
              </div>
            {:else}
              <div class="pending">Awaiting admin reply</div>
            {/if}
          </article>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .feedback-page {
    max-width: 820px;
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
    color: #fff;
  }

  .feedback-header {
    margin-bottom: 1rem;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--color-text-secondary);
    text-decoration: none;
    margin-bottom: 0.8rem;
  }

  .back-link:hover {
    color: #fff;
  }

  .feedback-header p {
    margin-top: 0.4rem;
    color: var(--color-text-secondary);
  }

  .panel {
    margin-top: 1rem;
    background: rgba(25, 25, 25, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1rem;
    padding: 1.2rem;
  }

  h2 {
    font-size: 1.05rem;
    margin-bottom: 0.8rem;
  }

  .composer {
    display: grid;
    gap: 0.6rem;
  }

  textarea {
    border-radius: 0.6rem;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(0, 0, 0, 0.25);
    color: #fff;
    padding: 0.7rem 0.8rem;
  }

  .attachment-field { display: grid; gap: 0.4rem; color: var(--color-text-secondary); font-size: 0.9rem; }
  .attachment-field small, .hint { color: var(--color-text-muted); }
  input[type='file'] { max-width: 100%; }
  .screenshot-help p, .screenshot-help ol { color: var(--color-text-secondary); line-height: 1.55; }
  .screenshot-help ol { padding-left: 1.3rem; }
  .screenshot-help li + li { margin-top: 0.3rem; }
  .hint { font-size: 0.84rem; margin-top: 0.75rem; }
  .attachment { display: block; width: fit-content; max-width: 100%; margin-top: 0.7rem; color: var(--color-text-secondary); font-size: 0.82rem; }
  .attachment img { display: block; max-width: min(100%, 420px); max-height: 320px; object-fit: contain; border-radius: 0.55rem; border: 1px solid rgba(255, 255, 255, 0.12); margin-bottom: 0.3rem; }

  .primary {
    width: fit-content;
    margin-top: 0.5rem;
  }

  .entries {
    display: grid;
    gap: 0.8rem;
  }

  .entry {
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
    border-radius: 0.8rem;
    padding: 0.9rem;
  }

  .meta,
  .reply-meta,
  .pending,
  .empty {
    color: var(--color-text-muted);
    font-size: 0.82rem;
  }

  .message {
    margin-top: 0.4rem;
    white-space: pre-wrap;
  }

  .reply {
    margin-top: 0.8rem;
    padding: 0.7rem;
    border-radius: 0.7rem;
    border: 1px solid rgba(74, 158, 254, 0.35);
    background: rgba(74, 158, 254, 0.08);
  }

  .reply p {
    margin-top: 0.35rem;
    white-space: pre-wrap;
  }

  .pending {
    margin-top: 0.7rem;
  }

  .notice {
    padding: 0.65rem 0.8rem;
    border-radius: 0.6rem;
    margin-bottom: 0.75rem;
    font-size: 0.88rem;
  }

  .notice.error {
    border: 1px solid rgba(244, 67, 54, 0.35);
    background: rgba(244, 67, 54, 0.12);
    color: #ff9d9d;
  }

  .notice.success {
    border: 1px solid rgba(76, 175, 80, 0.35);
    background: rgba(76, 175, 80, 0.12);
    color: #a6e3aa;
  }

  svg {
    fill: currentColor;
  }
</style>
