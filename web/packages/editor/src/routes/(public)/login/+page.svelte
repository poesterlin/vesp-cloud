<script lang="ts">
  import { page } from '$app/state';
  import { track } from '$lib/analytics';

  let { form } = $props();

  const redirectParam = $derived(page.url.searchParams.get('redirect') || '');
</script>

<svelte:head>
  <title>vESP.cloud — Sign In</title>
</svelte:head>

<div class="auth-page">
  <div class="auth-card">
    <h1>Sign In</h1>
    <p class="subtitle">vESP.cloud</p>

    {#if form?.message}
      <div class="error-message">{form.message}</div>
    {/if}

    <form method="POST" action="?/login" onsubmit={() => track('auth_login_submitted')}>
      <input type="hidden" name="redirectTo" value={redirectParam} />

      <div class="field">
        <label for="username">Username</label>
        <input id="username" name="username" type="text" required />
      </div>

      <div class="field">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" required />
      </div>

      <button type="submit" class="primary">Sign In</button>
    </form>

    <p class="helper"><a href="/forgot-password{redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : ''}">Forgot password?</a></p>

    <p class="switch-link">
      Don't have an account? <a href="/register{redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : ''}">Register</a>
    </p>
  </div>
</div>

<style>
  .auth-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
  }

  .auth-card {
    background: #161616;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1.5rem;
    padding: 3rem;
    width: 100%;
    max-width: 420px;
  }

  h1 {
    font-size: 2rem;
    font-weight: 800;
    margin: 0 0 0.25rem 0;
    color: #fff;
  }

  .subtitle {
    color: var(--color-text-muted);
    margin: 0 0 2rem 0;
    font-size: 0.95rem;
  }

  .error-message {
    background: rgba(255, 82, 82, 0.1);
    border: 1px solid rgba(255, 82, 82, 0.2);
    color: #ff5252;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    font-size: 0.85rem;
    margin-bottom: 1.5rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .field label {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-secondary);
  }

  .field input {
    padding: 0.85rem 1rem;
    background: #1e1e1e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.75rem;
    color: #fff;
    font-size: 1rem;
  }

  .field input:focus {
    border-color: var(--color-accent);
    outline: none;
    box-shadow: 0 0 0 3px rgba(74, 158, 254, 0.1);
  }

  button.primary {
    margin-top: 0.5rem;
    padding: 0.85rem;
    background: var(--color-accent);
    border: none;
    border-radius: 0.75rem;
    color: #fff;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  button.primary:hover {
    opacity: 0.9;
  }

  .helper {
    margin: 1rem 0 0;
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }

  .helper a {
    color: var(--color-accent);
    text-decoration: none;
  }

  .helper a:hover {
    text-decoration: underline;
  }

  .switch-link {
    text-align: center;
    margin-top: 1.5rem;
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }

  .switch-link a {
    color: var(--color-accent);
    text-decoration: none;
  }

  .switch-link a:hover {
    text-decoration: underline;
  }
</style>
