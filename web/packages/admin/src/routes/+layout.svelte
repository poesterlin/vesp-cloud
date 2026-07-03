<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  let { children } = $props();

  function isActive(path: string) {
    return $page.url.pathname === path;
  }
  function isActivePrefix(prefix: string) {
    return $page.url.pathname.startsWith(prefix);
  }
</script>

<div class="layout">
  <nav class="sidebar">
    <h1 class="logo">ESPHome Admin</h1>
    <a href="/" class:active={isActive('/')}>Dashboard</a>
    <a href="/users" class:active={isActivePrefix('/users')}>Users</a>
    <a href="/jobs" class:active={isActivePrefix('/jobs')}>Jobs</a>
    <a href="/withdrawals" class:active={isActivePrefix('/withdrawals')}>Withdrawals</a>
    <a href="/feedback" class:active={isActivePrefix('/feedback')}>Feedback</a>
  </nav>
  <main class="content">
    {@render children()}
  </main>
</div>

<style>
  .layout {
    display: flex;
    height: 100vh;
    width: 100%;
  }
  .sidebar {
    width: 220px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    padding: 20px 0;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }
  .logo {
    font-size: 16px;
    font-weight: 700;
    padding: 0 20px 20px;
    color: var(--accent);
  }
  .sidebar a {
    padding: 10px 20px;
    color: var(--text-secondary);
    font-size: 14px;
    border-left: 3px solid transparent;
    transition: all 150ms;
  }
  .sidebar a:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    text-decoration: none;
  }
  .sidebar a.active {
    color: var(--accent);
    border-left-color: var(--accent);
    background: var(--bg-tertiary);
  }
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 30px 40px;
  }
</style>
