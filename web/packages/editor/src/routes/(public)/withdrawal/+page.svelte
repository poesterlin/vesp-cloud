<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';

  let { data, form } = $props();

  const currency = Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });

  const step = $derived(
    form?.step === 'select'
      ? 'select'
      : form?.step === 'confirm'
        ? 'confirm'
        : form?.step === 'success'
          ? 'success'
          : data.step,
  );

  const token = $derived(form?.token ?? data.token ?? '');
  const listToken = $derived(form?.listToken ?? data.listToken ?? '');
  const orders = $derived(data.orders ?? []);
  const alreadySubmitted = $derived(form?.alreadySubmitted ?? data.alreadySubmitted ?? false);
  const errorMessage = $derived(form?.message ?? data.error ?? null);

  let selectedOrderId = $state('');
  let showManualEntry = $state(false);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  function shortOrderId(id: string) {
    if (id.length <= 16) return id;
    return `${id.slice(0, 10)}…${id.slice(-6)}`;
  }
</script>

<svelte:head>
  <title>vESP.cloud — Withdrawal</title>
</svelte:head>

<div class="withdrawal-page">
  <header class="withdrawal-header">
    <a href="/intro" class="back-link">Back</a>
    <h1>Withdraw from contract</h1>
    <p class="subtitle">Exercise your right of withdrawal for a credit pack purchase</p>
  </header>

  <main class="withdrawal-content">
    {#if errorMessage}
      <div class="alert error">{errorMessage}</div>
    {/if}

    {#if step === 'identify'}
      <section class="card">
        <h2>Step 1: Find your purchase</h2>
        <p>Enter the email address on your account. We will show your credit pack orders.</p>

        <form
          method="POST"
          action="?/listOrders"
          use:enhance={() => {
            return async ({ result }) => {
              if (result.type === 'success' && result.data?.step === 'select' && typeof result.data.listToken === 'string') {
                await goto(`/withdrawal?step=select&listToken=${encodeURIComponent(result.data.listToken)}`);
              }
            };
          }}
        >
          <div class="field">
            <label for="email">Email address</label>
            <input id="email" name="email" type="email" autocomplete="email" required />
          </div>

          <button type="submit" class="primary">Find my orders</button>
        </form>

        <details class="manual-entry" bind:open={showManualEntry}>
          <summary>Have your order ID already?</summary>
          <p>Enter the order ID from your Stripe receipt email (starts with <code>cs_</code>).</p>

          <form
            method="POST"
            action="?/identify"
            use:enhance={() => {
              return async ({ result }) => {
                if (result.type === 'success' && result.data?.step === 'confirm' && typeof result.data.token === 'string') {
                  await goto(`/withdrawal?step=confirm&token=${encodeURIComponent(result.data.token)}`);
                } else if (result.type === 'success' && result.data?.step === 'success') {
                  await goto('/withdrawal?step=success');
                }
              };
            }}
          >
            <div class="field">
              <label for="manual-email">Email address</label>
              <input id="manual-email" name="email" type="email" autocomplete="email" required />
            </div>

            <div class="field">
              <label for="orderId">Order ID</label>
              <input
                id="orderId"
                name="orderId"
                type="text"
                placeholder="cs_test_..."
                autocomplete="off"
                required
              />
            </div>

            <button type="submit" class="secondary">Continue with order ID</button>
          </form>
        </details>
      </section>
    {:else if step === 'select' && orders.length > 0}
      <section class="card">
        <h2>Step 1: Select your purchase</h2>
        <p>Choose the order you want to withdraw from.</p>

        <form
          method="POST"
          action="?/identify"
          use:enhance={() => {
            return async ({ result }) => {
              if (result.type === 'success' && result.data?.step === 'confirm' && typeof result.data.token === 'string') {
                await goto(`/withdrawal?step=confirm&token=${encodeURIComponent(result.data.token)}`);
              } else if (result.type === 'success' && result.data?.step === 'success') {
                await goto('/withdrawal?step=success');
              }
            };
          }}
        >
          <input type="hidden" name="listToken" value={listToken} />

          <div class="order-list" role="radiogroup" aria-label="Your orders">
            {#each orders as order (order.stripeSessionId)}
              <label class="order-option" class:disabled={order.withdrawalActive}>
                <input
                  type="radio"
                  name="orderId"
                  value={order.stripeSessionId}
                  bind:group={selectedOrderId}
                  disabled={order.withdrawalActive}
                  required
                />
                <div class="order-body">
                  <div class="order-top">
                    <strong>{order.packName}</strong>
                    <span>{currency.format(order.amountPaid)}</span>
                  </div>
                  <div class="order-meta">
                    {order.creditsPurchased} credits · {formatDate(order.purchasedAt)}
                  </div>
                  <div class="order-id">
                    <code>{shortOrderId(order.stripeSessionId)}</code>
                  </div>
                  {#if order.withdrawalActive}
                    <div class="order-badge">Withdrawal already submitted</div>
                  {/if}
                </div>
              </label>
            {/each}
          </div>

          <button type="submit" class="primary" disabled={!selectedOrderId}>Continue</button>
        </form>

        <p class="helper">
          <a href="/withdrawal">Use a different email</a>
        </p>
      </section>
    {:else if step === 'confirm' && data.purchase}
      <section class="card">
        <h2>Step 2: Confirm withdrawal</h2>
        <p>Review your order details and confirm that you want to withdraw from this purchase.</p>

        <dl class="summary">
          <div>
            <dt>Order ID</dt>
            <dd><code>{data.purchase.stripeSessionId}</code></dd>
          </div>
          <div>
            <dt>Purchase date</dt>
            <dd>{formatDate(data.purchase.purchasedAt)}</dd>
          </div>
          <div>
            <dt>Pack</dt>
            <dd>{data.purchase.packName} ({data.purchase.creditsPurchased} credits)</dd>
          </div>
          <div>
            <dt>Amount paid</dt>
            <dd>{currency.format(data.purchase.amountPaid)}</dd>
          </div>
        </dl>

        {#if data.purchase.hasUsedCredits}
          <div class="alert warning">
            Some credits from this purchase may already have been used ({data.purchase.creditsConsumed} of
            {data.purchase.creditsPurchased}). Your withdrawal will be reviewed manually and any refund may
            be adjusted accordingly.
          </div>
        {/if}

        <form
          method="POST"
          action="?/confirm"
          use:enhance={() => {
            return async ({ result }) => {
              if (result.type === 'success' && result.data?.step === 'success') {
                await goto('/withdrawal?step=success');
              }
            };
          }}
        >
          <input type="hidden" name="token" value={token} />
          <button type="submit" class="danger">Confirm withdrawal</button>
        </form>

        <p class="helper">
          <a href="/withdrawal">Start over</a>
        </p>
      </section>
    {:else if step === 'success'}
      <section class="card success-card">
        <h2>Withdrawal received</h2>
        {#if alreadySubmitted}
          <p>
            A withdrawal request for this order has already been submitted. If you need help, contact
            <a href="mailto:support@vesp-cloud.com">support@vesp-cloud.com</a>.
          </p>
        {:else}
          <p>
            Your withdrawal has been recorded and a confirmation email has been sent to your inbox.
          </p>
          <p>
            Refund processing may take a few business days. You will be contacted if
            we need additional information.
          </p>
        {/if}
        <p class="helper">
          <a href="/terms">View General Terms and Conditions (AGB)</a>
        </p>
      </section>
    {/if}
  </main>
</div>

<style>
  .withdrawal-page {
    min-height: 100vh;
    max-width: 640px;
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
    color: #fff;
  }

  .withdrawal-header {
    margin-bottom: 2rem;
  }

  .back-link {
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: 0.9rem;
  }

  .back-link:hover {
    color: #fff;
  }

  h1 {
    margin-top: 0.8rem;
    font-size: 1.8rem;
  }

  .subtitle {
    color: var(--color-text-muted);
    margin-top: 0.4rem;
  }

  .card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.9rem;
    padding: 1.25rem;
  }

  h2 {
    font-size: 1.05rem;
    margin-bottom: 0.6rem;
  }

  p {
    color: var(--color-text-secondary);
    line-height: 1.55;
    margin-bottom: 1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 1rem;
  }

  label {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  input[type='email'],
  input[type='text'] {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 0.6rem;
    color: #fff;
    padding: 0.7rem 0.85rem;
    font: inherit;
  }

  input:focus {
    outline: none;
    border-color: rgba(74, 158, 254, 0.6);
  }

  button {
    border: none;
    border-radius: 0.65rem;
    padding: 0.75rem 1rem;
    font-weight: 600;
    cursor: pointer;
    font: inherit;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .primary {
    background: var(--color-accent);
    color: #fff;
    width: 100%;
  }

  .secondary {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #fff;
    width: 100%;
  }

  .danger {
    background: #dc2626;
    color: #fff;
    width: 100%;
  }

  .manual-entry {
    margin-top: 1.25rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 1rem;
  }

  .manual-entry summary {
    cursor: pointer;
    color: #9fd2ff;
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }

  .order-list {
    display: grid;
    gap: 0.65rem;
    margin-bottom: 1rem;
  }

  .order-option {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    padding: 0.85rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0.7rem;
    background: rgba(255, 255, 255, 0.03);
    cursor: pointer;
  }

  .order-option:has(input:checked) {
    border-color: rgba(74, 158, 254, 0.55);
    background: rgba(74, 158, 254, 0.08);
  }

  .order-option.disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .order-option input {
    margin-top: 0.2rem;
    flex-shrink: 0;
  }

  .order-body {
    flex: 1;
    min-width: 0;
  }

  .order-top {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    color: #fff;
    margin-bottom: 0.2rem;
  }

  .order-meta {
    font-size: 0.84rem;
    color: var(--color-text-muted);
  }

  .order-id {
    margin-top: 0.35rem;
  }

  .order-id code {
    font-size: 0.78rem;
    color: var(--color-text-secondary);
  }

  .order-badge {
    margin-top: 0.45rem;
    font-size: 0.78rem;
    color: #f5d78e;
  }

  .summary {
    display: grid;
    gap: 0.75rem;
    margin: 1rem 0 1.25rem;
    padding: 0.9rem;
    border-radius: 0.65rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .summary div {
    display: grid;
    gap: 0.15rem;
  }

  dt {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  dd {
    margin: 0;
    color: #fff;
  }

  code {
    font-size: 0.85rem;
    word-break: break-all;
  }

  .alert {
    border-radius: 0.65rem;
    padding: 0.8rem 0.9rem;
    margin-bottom: 1rem;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .alert.error {
    color: #ff9d9d;
    background: rgba(244, 67, 54, 0.15);
    border: 1px solid rgba(244, 67, 54, 0.35);
  }

  .alert.warning {
    color: #f5d78e;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.35);
  }

  .success-card p {
    margin-bottom: 0.75rem;
  }

  .helper {
    margin-top: 1rem;
    margin-bottom: 0;
    font-size: 0.85rem;
  }

  .helper a {
    color: #9fd2ff;
  }

  a {
    color: #9fd2ff;
  }
</style>
