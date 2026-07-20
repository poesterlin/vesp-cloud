<script lang="ts">
  import * as mdiIcons from "@mdi/js";
  import { track } from "$lib/analytics";
  let { data } = $props();

  const balance = $derived(data.balance);
  let checkoutStatus = $state<string | null>(data.checkoutStatus);
  let purchasing = $state<string | null>(null);
  let error = $state<string | null>(null);
  let consentChecked = $state(false);

  $effect(() => {
    if (!checkoutStatus) return;

    if (checkoutStatus === "success") {
      track("checkout_completed", { outcome: "success" });
    }

    const id = setTimeout(() => (checkoutStatus = null), 6000);
    history.replaceState({}, "", "/credits");
    return () => clearTimeout(id);
  });

  const currency = Intl.NumberFormat("us", {
    style: "currency",
    currency: "EUR",
    compactDisplay: "long",
    minimumFractionDigits: 2,
    currencyDisplay: "symbol",
  });

  const packs = $derived(
    (data.packs ?? []).map((p) => ({
      ...p,
      unitPrice: p.price / p.credits,
    })),
  );

  async function buyPack(pack: { priceId: string; priceKey: string }) {
    if (!consentChecked) {
      error =
        "Please accept immediate delivery of digital credits before purchasing.";
      return;
    }

    purchasing = pack.priceKey;
    error = null;
    track("checkout_started", { pack: pack.priceKey });

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: pack.priceId,
          immediatePerformanceConsent: true,
        }),
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Checkout failed");

      window.location.href = json.url;
    } catch (err: any) {
      error = err.message;
      purchasing = null;
    }
  }
</script>

<svelte:head>
  <title>vESP.cloud — Credits</title>
</svelte:head>

<div class="credits-page">
  <header class="credits-header">
    <a href="/" class="back-link">
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path d={mdiIcons.mdiArrowLeft} />
      </svg>
      Back to Projects
    </a>
    <a href="/account" class="account-link">
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path d={mdiIcons.mdiAccount} />
      </svg>
      Account
    </a>
  </header>

  <main class="credits-content">
    {#if checkoutStatus === "success"}
      <div class="toast success">
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path d={mdiIcons.mdiCheckCircle} />
        </svg>
        <div>
          {balance > 0
            ? "Payment successful! Credits have been added to your balance."
            : "Payment successful! Credits will appear shortly."}
          <span class="toast-detail">
            Your order confirmation was sent to your email. Use the order ID from that
            email if you need to
            <a href="/withdrawal">withdraw from your purchase</a>.
          </span>
        </div>
      </div>
    {:else if checkoutStatus === "cancelled"}
      <div class="toast muted">
        Checkout cancelled. Your credits remain unchanged.
      </div>
    {/if}

    {#if error}
      <div class="toast error">
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path d={mdiIcons.mdiAlertCircle} />
        </svg>
        {error}
      </div>
    {/if}

    <section class="balance-card">
      <div class="balance-label">Available Credits</div>
      <div class="balance-amount">{balance}</div>
      <div class="balance-sub">1 credit = 1 firmware build</div>
    </section>

    <section>
      <h1>Buy Build Credits</h1>
      <p class="subhead">
        Top up your account and keep your firmware build workflow moving.
      </p>
      <p class="legal-note">
        By purchasing credits, you agree to our <a href="/terms"
          >General Terms and Conditions (AGB)</a
        >. Credits are non-refundable except where required by law. You
        may
        <a href="/withdrawal">withdraw from your purchase</a>.
      </p>

      <label class="consent">
        <input type="checkbox" bind:checked={consentChecked} />
        <span>
          I agree to immediate delivery of digital build credits and acknowledge
          that I may lose my right of withdrawal once I use credits to run a
          build.
        </span>
      </label>

      <div class="packs-grid">
        {#each packs as pack (pack.priceKey)}
          {@const popular = pack.credits === 50}
          <article class="pack-card" class:popular>
            {#if popular}
              <div class="popular-badge">Best Value</div>
            {/if}
            <div class="pack-name">{pack.name}</div>
            <div class="pack-credits">{pack.credits} builds</div>
            <div class="pack-price">{currency.format(pack.price)}</div>
            <div class="pack-unit">
              {currency.format(pack.unitPrice)} per build
            </div>
            <button
              class="buy-btn"
              class:popular-btn={popular}
              disabled={purchasing === pack.priceKey || !consentChecked}
              onclick={() => buyPack(pack)}
            >
              {#if purchasing === pack.priceKey}
                Redirecting...
              {:else}
                Buy {pack.name}
              {/if}
            </button>
          </article>
        {/each}
      </div>
    </section>
  </main>
</div>

<style>
  .credits-page {
    min-height: 100vh;
    background: var(--color-bg-primary);
    color: #fff;
  }

  .credits-header {
    padding: 1rem 2rem;
    border-bottom: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .back-link,
  .account-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: 0.9rem;
    transition: color var(--transition-fast);
  }

  .back-link:hover,
  .account-link:hover {
    color: #fff;
  }

  .credits-content {
    max-width: 860px;
    margin: 0 auto;
    padding: 2.4rem 1.2rem 4rem;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    margin-bottom: 1rem;
    padding: 0.9rem 1rem;
    border-radius: 0.7rem;
    border: 1px solid transparent;
  }

  .toast.success {
    color: #97e3aa;
    background: rgba(76, 175, 80, 0.13);
    border-color: rgba(76, 175, 80, 0.35);
  }

  .toast.success path {
    fill: currentColor;
  }

  .toast.muted {
    color: var(--color-text-secondary);
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .toast.error {
    color: #ff9d9d;
    background: rgba(244, 67, 54, 0.15);
    border-color: rgba(244, 67, 54, 0.35);
  }

  .toast.error path {
    fill: currentColor;
  }

  .balance-card {
    text-align: center;
    padding: 2.4rem;
    margin: 1.1rem 0 2rem;
    border-radius: 1rem;
    border: 1px solid rgba(74, 158, 254, 0.3);
    background: rgba(20, 20, 36, 0.9);
  }

  .balance-label {
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    margin-bottom: 0.4rem;
  }

  .balance-amount {
    font-size: 3.2rem;
    font-weight: 800;
    line-height: 1;
    color: #7bc4ff;
    margin-bottom: 0.4rem;
  }

  .balance-sub {
    color: var(--color-text-muted);
    font-size: 0.86rem;
  }

  h1 {
    font-size: 1.3rem;
    margin-bottom: 0.3rem;
  }

  .subhead {
    color: var(--color-text-secondary);
    margin-bottom: 1.25rem;
  }

  .legal-note {
    color: var(--color-text-muted);
    font-size: 0.82rem;
    margin-bottom: 1.2rem;
  }

  .legal-note a {
    color: #9fd2ff;
  }

  .consent {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    color: var(--color-text-secondary);
    font-size: 0.84rem;
    line-height: 1.45;
    margin-bottom: 1.2rem;
    cursor: pointer;
  }

  .consent input {
    margin-top: 0.15rem;
    flex-shrink: 0;
  }

  .toast-detail {
    display: block;
    margin-top: 0.35rem;
    font-size: 0.82rem;
    opacity: 0.9;
  }

  .toast-detail a {
    color: inherit;
    text-decoration: underline;
  }

  .toast-detail code {
    font-size: 0.78rem;
    word-break: break-all;
  }

  .packs-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .pack-card {
    position: relative;
    text-align: center;
    padding: 1.4rem;
    border-radius: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
  }

  .pack-card.popular {
    border-color: rgba(74, 158, 254, 0.45);
    background: rgba(27, 27, 46, 0.93);
  }

  .popular-badge {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-accent);
    color: #fff;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.25rem 0.7rem;
    border-radius: 999px;
  }

  .pack-name {
    font-size: 1.05rem;
    font-weight: 700;
    margin-bottom: 0.35rem;
  }

  .pack-credits {
    font-size: 1.7rem;
    font-weight: 800;
    color: #7bc4ff;
  }

  .pack-price {
    margin-top: 0.25rem;
    font-size: 1.45rem;
    font-weight: 700;
  }

  .pack-unit {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin: 0.3rem 0 0.95rem;
  }

  .buy-btn {
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 0.7rem;
    background: rgba(255, 255, 255, 0.03);
    color: #fff;
    padding: 0.72rem;
    font-weight: 600;
  }

  .buy-btn:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.35);
    background: rgba(255, 255, 255, 0.08);
  }

  .buy-btn.popular-btn {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }

  .buy-btn.popular-btn:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }

  .buy-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  svg path {
    fill: currentColor;
  }

  @media (max-width: 760px) {
    .packs-grid {
      grid-template-columns: 1fr;
    }

    .credits-header {
      padding: 1rem 1.2rem;
    }
  }
</style>
