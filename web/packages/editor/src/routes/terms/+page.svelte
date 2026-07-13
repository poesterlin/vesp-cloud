<svelte:head>
  <title>vESP.cloud — Terms</title>
</svelte:head>

<div class="terms-page">
  <header class="terms-header">
    <a href="/" class="back-link">Back to App</a>
    <h1>Terms of Service</h1>
    <p>Last updated: June 16, 2026</p>
  </header>

  <main class="terms-content">
    <section>
      <h2>1. Service Use</h2>
      <p>
        vESP.cloud is provided as-is to help you create and export interface configurations and firmware builds.
        You are responsible for your own devices, automations, and deployment outcomes.
      </p>
    </section>

    <section>
      <h2>2. Accounts</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account credentials and all activity under your
        account.
      </p>
    </section>

    <section>
      <h2>3. Credits and Payments</h2>
      <p>
        Credits may be purchased to run firmware builds. Unless required by law, credits are non-transferable,
        non-refundable, and have no cash value.
      </p>
      <p>
        Pricing and credit packs may change over time. Changes do not apply retroactively to credits already purchased.
      </p>
      <p>
        Statutory withdrawal rights for consumers are described in section 8 below.
      </p>
    </section>

    <section>
      <h2>4. Account Deletion</h2>
      <p>
        If you delete your account, your data and project access are permanently removed. Any unused credits are
        forfeited and are not refunded unless required by applicable law.
      </p>
    </section>

    <section>
      <h2>5. Availability and Changes</h2>
      <p>
        We may update, suspend, or discontinue parts of the service at any time. We may update these terms from time to
        time by publishing a revised version on this page.
      </p>
    </section>

    <section>
      <h2>6. Data Protection and Privacy</h2>
      <p>
        We do not collect your Wi-Fi authentication details, Home Assistant access tokens, or similar connection
        secrets through this service.
      </p>
      <p>
        Home Assistant entity dumps are optional and intended for local use on your device. These dumps may include
        metadata such as entity IDs, names, domains, states, attributes, and timestamps.
      </p>
      <p>
        For hosted storage, we retain account information, project settings, and billing-related records needed to
        operate the service. We do not sell personal data.
      </p>
      <p>
        The project is open source, so data handling behavior can be reviewed in code.
      </p>
    </section>

    <section>
      <h2>7. Contact</h2>
      <p>
        For billing, withdrawal, or account issues, contact
        <a href="mailto:support@vesp-cloud.com">support@vesp-cloud.com</a>.
      </p>
    </section>

    <section>
      <h2>8. Right of Withdrawal (Consumers)</h2>
      <p>
        If you are a consumer in the European Union or another jurisdiction that grants a statutory right of
        withdrawal, you may withdraw from a credit pack purchase within 14 days of purchase without giving a reason.
      </p>
      <p>
        To exercise this right, use our
        <a href="/withdrawal">withdrawal form</a>. You will need the email address associated with your account
        and the order ID from your Stripe receipt email (starts with <code>cs_</code>). After you confirm your
        withdrawal, you will receive a confirmation email.
      </p>
      <p>
        The withdrawal period expires 14 days after the day of purchase. To meet the deadline, it is sufficient
        that you submit the withdrawal request before the period expires.
      </p>
    </section>

    <section>
      <h2>9. Digital Services and Immediate Performance</h2>
      <p>
        Build credits are digital content delivered immediately after payment. At checkout, you are asked to
        consent to immediate delivery and acknowledge that your right of withdrawal may be lost once you use
        credits to run a build.
      </p>
      <p>
        If you have consented to immediate performance and have begun using credits, your statutory withdrawal
        right may no longer apply to the portion of the service already performed. Any remaining unused credits
        may still be reviewed on a case-by-case basis where required by law.
      </p>
    </section>

    <section>
      <h2>10. Refund Processing</h2>
      <p>
        Approved withdrawals are refunded to your original payment method. Processing typically takes a
        few business days after review. If credits from the purchase have already been used, any refund may be
        reduced accordingly.
      </p>
      <p>
        Credits are normally non-refundable outside of statutory withdrawal rights or other legal requirements.
        Nothing in these terms limits your mandatory consumer rights under applicable law.
      </p>
    </section>
  </main>
</div>

<style>
  .terms-page {
    min-height: 100vh;
    max-width: 880px;
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
    color: #fff;
  }

  .terms-header {
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
    font-size: 2rem;
  }

  .terms-header p {
    color: var(--color-text-muted);
    margin-top: 0.4rem;
  }

  .terms-content {
    display: grid;
    gap: 1.1rem;
  }

  section {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.8rem;
    padding: 1rem;
  }

  h2 {
    font-size: 1rem;
    margin-bottom: 0.45rem;
  }

  p {
    color: var(--color-text-secondary);
    line-height: 1.55;
  }

  section p + p {
    margin-top: 0.5rem;
  }

  a {
    color: #9fd2ff;
  }

  code {
    font-size: 0.9em;
  }
</style>
