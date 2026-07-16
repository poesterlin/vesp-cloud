<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>vESP.cloud — Email verification</title>
</svelte:head>

<main class="verification-page">
  <section class="verification-card">
    <div class:success={data.verified} class="status-icon">{data.verified ? "✓" : "!"}</div>
    <h1>{data.verified ? "Email verified" : "Link invalid or expired"}</h1>
    <p>
      {data.verified
        ? "Your email address has been verified."
        : "This verification link cannot be used. Request a new one from your account profile."}
    </p>
    <a href="/account">Back to account</a>
  </section>
</main>

<style>
  .verification-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 1.25rem;
    background: var(--color-bg-primary);
    color: #fff;
  }

  .verification-card {
    width: min(100%, 460px);
    padding: 2rem;
    text-align: center;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    background: rgba(25, 25, 25, 0.95);
  }

  .status-icon {
    width: 52px;
    height: 52px;
    margin: 0 auto 1rem;
    display: grid;
    place-items: center;
    border-radius: 999px;
    color: #ffb3b3;
    background: rgba(244, 67, 54, 0.14);
    font-size: 1.5rem;
    font-weight: 700;
  }

  .status-icon.success {
    color: #7ee2a8;
    background: rgba(46, 204, 113, 0.14);
  }

  h1 { margin-bottom: 0.75rem; font-size: 1.5rem; }
  p { color: var(--color-text-secondary); line-height: 1.6; }
  a {
    display: inline-block;
    margin-top: 1.5rem;
    padding: 0.75rem 1rem;
    border-radius: 0.7rem;
    color: #081018;
    background: var(--color-accent);
    text-decoration: none;
    font-weight: 700;
  }
</style>
