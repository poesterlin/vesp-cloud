<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();
</script>

<div class="auth-page">
  <div class="auth-card">
    <h1>Reset Password</h1>
    <p class="subtitle">vESP.cloud</p>

    {#if form?.message}
      <div class="error-message">{form.message}</div>
    {/if}

    {#if !data.valid}
      <p class="helper">This reset link is invalid or expired. Request a new one from the sign in page.</p>
      <p class="switch-link"><a href="/forgot-password">Request a new link</a></p>
      <p class="switch-link"><a href="/login">Back to Sign In</a></p>
    {:else}
      <p class="helper">Choose a new password for your account.</p>

      <form method="POST" action="?/resetPassword" use:enhance>
        <input type="hidden" name="token" value={data.token} />

        <div class="field">
          <label for="password">New Password</label>
          <input id="password" name="password" type="password" required />
        </div>

        <button type="submit" class="primary">Update Password</button>
      </form>
    {/if}
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
    margin: 0 0 1.5rem 0;
    font-size: 0.95rem;
  }

  .error-message {
    background: rgba(255, 82, 82, 0.1);
    border: 1px solid rgba(255, 82, 82, 0.2);
    color: #ff5252;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    font-size: 0.85rem;
    margin-bottom: 1.25rem;
  }

  .helper {
    margin: 0 0 1.25rem;
    color: var(--color-text-muted);
    font-size: 0.85rem;
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

  .switch-link {
    text-align: center;
    margin-top: 0.75rem;
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
