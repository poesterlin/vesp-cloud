<script lang="ts">
    let { data } = $props()
</script>

<svelte:head>
    <title>Login - Admin</title>
</svelte:head>

<div class="login">
    <h1>ESPHome Admin</h1>
    <a href={data.authUrl} class="login-btn">Sign in with Tailscale</a>
</div>

<style>
    .login {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        gap: 24px;
    }
    .login h1 {
        font-size: 24px;
        color: var(--accent);
    }
    .login-btn {
        padding: 12px 32px;
        background: var(--accent);
        color: #fff;
        border-radius: var(--radius);
        font-size: 16px;
        text-decoration: none;
    }
    .login-btn:hover {
        opacity: 0.9;
        text-decoration: none;
    }
</style>
