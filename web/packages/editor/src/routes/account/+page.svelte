<script lang="ts">
  import * as mdiIcons from "@mdi/js";

  let { data, form } = $props();

  const memberSince = $derived(
    data.user?.createdAt
      ? new Intl.DateTimeFormat(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        }).format(new Date(data.user.createdAt))
      : "Unknown",
  );

  const lastLogin = $derived(
    data.user?.lastLogin
      ? new Intl.DateTimeFormat(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(data.user.lastLogin))
      : "No sign-in recorded",
  );
</script>

<svelte:head>
  <title>vESP.cloud — Account</title>
</svelte:head>

<div class="account-page">
  <header class="account-header">
    <a href="/" class="back-link">
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path d={mdiIcons.mdiArrowLeft} />
      </svg>
      Back to Projects
    </a>
  </header>

  <main class="account-content">
    <section class="profile-card">
      <div class="profile-top">
        <div class="avatar">{data.user?.username?.[0]?.toUpperCase() ?? "?"}</div>
        <div>
          <div class="eyebrow">Your Account</div>
          <h1>{data.user?.username}</h1>
          <p>{data.user?.email ?? "No email on file"}</p>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">Member Since</span>
          <span class="meta-value">{memberSince}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Last Login</span>
          <span class="meta-value">{lastLogin}</span>
        </div>
      </div>
    </section>

    <section class="panel">
      <h2>Quick Actions</h2>
      <div class="action-list">
        <a href="/credits" class="action-link">
          <div>
            <strong>Manage Credits</strong>
            <p>Buy more build credits and check your current balance.</p>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d={mdiIcons.mdiChevronRight} />
          </svg>
        </a>

        <form action="/logout" method="post" class="action-form">
          <button type="submit" class="action-link button-link">
            <div>
              <strong>Sign Out</strong>
              <p>Log out of this browser session immediately.</p>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d={mdiIcons.mdiLogout} />
            </svg>
          </button>
        </form>
      </div>
    </section>

    <section class="panel danger-panel">
      <h2>Danger Zone</h2>
      <p class="danger-copy">
        Permanently delete your account, projects, sessions, and credit history. This cannot be undone.
      </p>
      <p class="danger-legal">
        Deletion removes your credit balance. Use purchased credits or contact support before deleting your account.
        See the <a href="/terms">General Terms and Conditions (AGB)</a>.
      </p>

      {#if form?.deleteError}
        <div class="error-box">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d={mdiIcons.mdiAlertCircle} />
          </svg>
          {form.deleteError}
        </div>
      {/if}

      <form method="POST" action="?/deleteAccount" class="delete-form">
        <label for="confirmUsername">Type your username to confirm</label>
        <input
          id="confirmUsername"
          name="confirmUsername"
          type="text"
          placeholder={data.user?.username}
          required
          autocomplete="off"
        />

        <label for="confirmPhrase">Type DELETE</label>
        <input
          id="confirmPhrase"
          name="confirmPhrase"
          type="text"
          placeholder="DELETE"
          required
          autocomplete="off"
        />

        <button class="delete-btn" type="submit">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d={mdiIcons.mdiDeleteForever} />
          </svg>
          Delete My Account
        </button>
      </form>
    </section>
  </main>
</div>

<style>
  .account-page {
    min-height: 100vh;
    background: var(--color-bg-primary);
    color: #fff;
  }

  .account-header {
    padding: 1rem 2rem;
    border-bottom: 1px solid var(--color-border);
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: 0.9rem;
    transition: color var(--transition-fast);
  }

  .back-link:hover {
    color: #fff;
  }

  .account-content {
    max-width: 820px;
    margin: 0 auto;
    padding: 2.5rem 1.25rem 4rem;
    display: grid;
    gap: 1.25rem;
  }

  .profile-card,
  .panel {
    background: rgba(25, 25, 25, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 1rem;
    padding: 1.5rem;
    backdrop-filter: blur(8px);
  }

  .profile-top {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .avatar {
    width: 52px;
    height: 52px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    font-size: 1.2rem;
    font-weight: 700;
    background: var(--color-accent);
    color: #081018;
  }

  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--color-text-muted);
    font-size: 0.74rem;
    margin-bottom: 0.2rem;
    font-weight: 700;
  }

  h1 {
    font-size: 1.4rem;
    margin-bottom: 0.2rem;
  }

  .profile-card p {
    color: var(--color-text-secondary);
  }

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .meta-item {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 0.75rem;
    padding: 0.9rem;
    display: grid;
    gap: 0.25rem;
  }

  .meta-label {
    color: var(--color-text-muted);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .meta-value {
    color: #fff;
    font-weight: 600;
  }

  h2 {
    font-size: 1.05rem;
    margin-bottom: 1rem;
  }

  .action-list {
    display: grid;
    gap: 0.75rem;
  }

  .action-link {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    color: inherit;
    text-decoration: none;
    padding: 1rem;
    border-radius: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
    transition: all var(--transition-fast);
  }

  .action-link p {
    margin-top: 0.2rem;
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }

  .action-link:hover {
    border-color: rgba(74, 158, 254, 0.5);
    transform: translateY(-1px);
  }

  .action-form {
    margin: 0;
  }

  .button-link {
    width: 100%;
    text-align: left;
    cursor: pointer;
  }

  .danger-panel {
    border-color: rgba(255, 82, 82, 0.25);
    background: rgba(47, 20, 20, 0.5);
  }

  .danger-copy {
    color: #ffb3b3;
    margin-bottom: 1rem;
  }

  .danger-legal {
    color: #ffbfbf;
    font-size: 0.85rem;
    margin-bottom: 1rem;
  }

  .danger-legal a {
    color: #ffd0d0;
  }

  .error-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    padding: 0.75rem;
    border-radius: 0.65rem;
    border: 1px solid rgba(244, 67, 54, 0.35);
    color: #ff8a8a;
    background: rgba(244, 67, 54, 0.12);
  }

  .delete-form {
    display: grid;
    gap: 0.7rem;
  }

  .delete-form label {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
  }

  .delete-form input {
    border-radius: 0.6rem;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(0, 0, 0, 0.25);
    color: #fff;
    padding: 0.7rem 0.8rem;
  }

  .delete-btn {
    margin-top: 0.4rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border-radius: 0.7rem;
    padding: 0.75rem 0.95rem;
    color: #fff;
    background: #d32f2f;
    border: 1px solid #e57373;
    font-weight: 700;
  }

  .delete-btn:hover {
    background: #c62828;
  }

  svg {
    fill: currentColor;
  }

  @media (max-width: 700px) {
    .account-header {
      padding: 1rem 1.25rem;
    }

    .meta-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
