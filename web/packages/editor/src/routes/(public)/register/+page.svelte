<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import { TERMS_VERSION } from '$lib/terms';
  import { track } from '$lib/analytics';
  import { fade } from 'svelte/transition';

  let { form, data } = $props();

  let username = $state('');
  let password = $state('');
  let showPassword = $state(false);

  const redirectParam = $derived(page.url.searchParams.get('redirect') || '');
  const validationErrors = $derived((form?.errors ?? []) as Array<{ path?: PropertyKey[]; message: string }>);
  const hasValidationErrors = $derived(validationErrors.length > 0);
  const hasValidCredentials = $derived(
    username.trim().length >= 3 &&
      username.trim().length <= 31 &&
      password.length >= 8 &&
      password.length <= 255 &&
      /[a-zA-Z]/.test(password) &&
      /[0-9]/.test(password)
  );

  function fieldError(field: string): string | undefined {
    return validationErrors.find((issue) => issue.path?.[0] === field)?.message;
  }
</script>

<svelte:head>
  <title>vESP.cloud — Sign Up</title>
</svelte:head>

<div class="auth-page">
  <div class="auth-card">
    <h1>Create Account</h1>
    <p class="subtitle">vESP.cloud</p>

    {#if form?.message && !hasValidationErrors}
      <div class="error-message" role="alert">{form.message}</div>
    {:else if hasValidationErrors}
      <div class="error-message" role="alert">Please correct the highlighted fields.</div>
    {/if}

    <form method="POST" action="?/register" use:enhance onsubmit={() => track('auth_registration_submitted')}>
      <input type="hidden" name="redirectTo" value={redirectParam} />

      <div class="field">
        <label for="username">Username</label>
        <input
          id="username"
          name="username"
          type="text"
          required
          minlength="3"
          maxlength="31"
          autocomplete="username"
          bind:value={username}
          aria-invalid={fieldError('username') ? 'true' : undefined}
          aria-describedby={fieldError('username') ? 'username-error' : 'username-help'}
        />
        {#if fieldError('username')}
          <p id="username-error" class="field-error">{fieldError('username')}</p>
        {:else}
          <p id="username-help" class="field-help">3–31 characters</p>
        {/if}
      </div>

      <div class="field">
        <label for="password">Password</label>
        <div class="password-input">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            minlength="8"
            maxlength="255"
            autocomplete="new-password"
            bind:value={password}
            aria-invalid={fieldError('password') ? 'true' : undefined}
            aria-describedby={fieldError('password')
              ? 'password-requirements password-error'
              : 'password-requirements'}
          />
          <button
            type="button"
            class="password-toggle"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            onclick={() => (showPassword = !showPassword)}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {#if fieldError('password')}
          <p id="password-error" class="field-error">{fieldError('password')}</p>
        {/if}
        <ul id="password-requirements" class="requirements" aria-label="Password requirements">
          <li class:met={password.length >= 8}>At least 8 characters</li>
          <li class:met={/[a-zA-Z]/.test(password)}>At least one letter</li>
          <li class:met={/[0-9]/.test(password)}>At least one number</li>
        </ul>
      </div>

      {#if hasValidCredentials || fieldError('email')}
        <div class="field" transition:fade={{ duration: 250 }}>
          <label for="email">Email <span class="optional">Optional</span></label>
          <input
            id="email"
            name="email"
            type="email"
            autocomplete="email"
            aria-invalid={fieldError('email') ? 'true' : undefined}
            aria-describedby={fieldError('email') ? 'email-error' : 'email-help'}
          />
          {#if fieldError('email')}
            <p id="email-error" class="field-error">{fieldError('email')}</p>
          {:else}
            <p id="email-help" class="recovery-hint">
              Email is optional. Without an email, account recovery is not available. You can add
              one later in account settings.
            </p>
          {/if}
        </div>
      {/if}

      {#if data.showCloudLegalPages}
        <label class="legal-consent" class:invalid={fieldError('acceptTerms')}>
          <input
            type="checkbox"
            name="acceptTerms"
            value="accepted"
            required
            aria-invalid={fieldError('acceptTerms') ? 'true' : undefined}
            aria-describedby={fieldError('acceptTerms') ? 'terms-error' : undefined}
          />
          <span>
            I accept the
            <a href="/terms" target="_blank" rel="noopener">General Terms and Conditions (AGB)</a>.
          </span>
        </label>
        <input type="hidden" name="termsVersion" value={TERMS_VERSION} />
        {#if fieldError('acceptTerms')}
          <p id="terms-error" class="field-error terms-error">{fieldError('acceptTerms')}</p>
        {/if}
      {/if}

      <button type="submit" class="primary">Create Account</button>

      {#if data.showCloudLegalPages}
        <p class="privacy-notice">
          We process your account information to provide and secure the service. Please read our
          <a href="/privacy">Privacy Policy</a>.
        </p>
      {/if}
    </form>

    <p class="switch-link">
      Already have an account? <a href="/login{redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : ''}">Sign In</a>
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

  .privacy-notice {
    color: var(--color-text-muted);
    font-size: 0.78rem;
    line-height: 1.45;
    text-align: center;
  }

  .privacy-notice a {
    color: var(--color-text-secondary);
  }

  .legal-consent {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: start;
    gap: 0.65rem;
    color: var(--color-text-secondary);
    font-size: 0.82rem;
    line-height: 1.45;
  }

  .legal-consent input {
    width: 1rem;
    height: 1rem;
    margin: 0.1rem 0 0;
    accent-color: var(--color-accent);
  }

  .legal-consent a {
    color: var(--color-accent);
  }

  .legal-consent.invalid {
    color: #ff7373;
  }

  .terms-error {
    margin-top: -0.85rem;
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

  .field label .optional {
    display: inline-block;
    margin-left: 0.35rem;
    padding: 0.15rem 0.4rem;
    border: 1px solid color-mix(in srgb, var(--color-accent) 45%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-accent) 12%, transparent);
    color: var(--color-accent);
    font-size: 0.68rem;
    font-weight: 700;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.04em;
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

  .field input[aria-invalid="true"] {
    border-color: #ff5252;
  }

  .password-input {
    position: relative;
  }

  .password-input input {
    box-sizing: border-box;
    width: 100%;
    padding-right: 4.5rem;
  }

  .password-toggle {
    position: absolute;
    top: 50%;
    right: 0.75rem;
    transform: translateY(-50%);
    padding: 0.3rem 0.45rem;
    border: 0;
    background: transparent;
    color: var(--color-accent);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }

  .password-toggle:focus-visible {
    border-radius: 0.25rem;
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .field-help,
  .field-error {
    margin: 0;
    font-size: 0.8rem;
  }

  .field-help {
    color: var(--color-text-muted);
  }

  .field-error {
    color: #ff7373;
  }

  .recovery-hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .requirements {
    display: grid;
    gap: 0.25rem;
    margin: 0;
    padding-left: 1.25rem;
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .requirements li::marker {
    content: '○  ';
  }

  .requirements li.met {
    color: #63d98b;
  }

  .requirements li.met::marker {
    content: '✓  ';
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
