<script lang="ts">
  import { page } from '$app/state';

  const isRateLimited = $derived(page.status === 429);
  const title = $derived(isRateLimited ? 'Slow down a moment' : 'Something went wrong');
  const message = $derived(
    page.error?.message ||
      (isRateLimited
        ? 'Too many requests were sent from your connection. Please wait and try again.'
        : 'The requested page could not be completed.'),
  );
</script>

<svelte:head>
  <title>{page.status} — vESP.cloud</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="error-page">
  <section class="error-card" aria-labelledby="error-title">
    <a class="brand" href="/intro" aria-label="vESP.cloud home">vESP.cloud</a>

    <div class="status" aria-hidden="true">{page.status}</div>
    <h1 id="error-title">{title}</h1>
    <p>{message}</p>

    {#if isRateLimited}
      <p class="hint">The limit resets automatically. Waiting a few minutes before retrying is usually enough.</p>
    {/if}

    <nav aria-label="Error recovery">
      <a class="primary" href={page.url.pathname}>Try again</a>
      <a class="secondary" href="/">Go to dashboard</a>
    </nav>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #0d0f12;
    color: #f4f7fa;
  }

  .error-page {
    min-height: 100vh;
    box-sizing: border-box;
    display: grid;
    place-items: center;
    padding: 2rem 1rem 5rem;
    background:
      radial-gradient(circle at 50% 15%, rgba(0, 229, 255, 0.12), transparent 32rem),
      #0d0f12;
  }

  .error-card {
    width: min(100%, 34rem);
    box-sizing: border-box;
    padding: clamp(2rem, 7vw, 3.5rem);
    border: 1px solid rgba(0, 229, 255, 0.28);
    border-radius: 1rem;
    background: rgba(20, 24, 29, 0.94);
    box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.42);
    text-align: center;
  }

  .brand {
    color: #00e5ff;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-decoration: none;
  }

  .status {
    margin-top: 1.75rem;
    color: rgba(0, 229, 255, 0.62);
    font: 700 clamp(3.5rem, 15vw, 6rem) / 1 monospace;
  }

  h1 {
    margin: 0.75rem 0;
    font-size: clamp(1.6rem, 6vw, 2.25rem);
  }

  p {
    margin: 0 auto;
    color: #c1c9d2;
    line-height: 1.6;
  }

  .hint {
    margin-top: 1rem;
    color: #8f9ba7;
    font-size: 0.9rem;
  }

  nav {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 2rem;
  }

  nav a {
    min-width: 8rem;
    padding: 0.75rem 1rem;
    border: 1px solid #00e5ff;
    border-radius: 0.5rem;
    font-weight: 650;
    text-decoration: none;
  }

  .primary {
    background: #00e5ff;
    color: #071014;
  }

  .secondary {
    color: #00e5ff;
  }

  nav a:hover,
  nav a:focus-visible {
    filter: brightness(1.15);
    outline: 2px solid rgba(255, 255, 255, 0.75);
    outline-offset: 3px;
  }
</style>
