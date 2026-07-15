<script lang="ts">
  import {
    hasMissingRequiredLegalValues,
    isMissingLegalValue,
    legalConfig,
  } from '$lib/legal-config';
</script>

<svelte:head>
  <title>vESP.cloud — Impressum</title>
  <meta
    name="description"
    content="Provider identification and legal contact information for vESP.cloud."
  />
</svelte:head>

<div class="legal-document">
  <header class="legal-document__header">
    <a href="/" class="legal-document__back">Back to App</a>
    <p class="legal-document__eyebrow">Legal information</p>
    <h1>Impressum</h1>
    <p>Provider identification pursuant to § 5 DDG</p>
  </header>

  <main class="legal-document__content">
    {#if hasMissingRequiredLegalValues}
      <aside class="legal-document__warning" role="alert">
        <strong>Not ready for publication</strong>
        <p>
          Required operator details are still missing. Configure the
          <code>PUBLIC_LEGAL_*</code> environment variables shown on this page before making the
          service public.
        </p>
      </aside>
    {/if}

    <section>
      <h2>Service provider</h2>
      <address>
        <span class:legal-missing={isMissingLegalValue(legalConfig.operatorName)}>
          {legalConfig.operatorName}
        </span>
        <span class:legal-missing={isMissingLegalValue(legalConfig.streetAddress)}>
          {legalConfig.streetAddress}
        </span>
        <span>
          <span class:legal-missing={isMissingLegalValue(legalConfig.postalCode)}>
            {legalConfig.postalCode}
          </span>
          <span class:legal-missing={isMissingLegalValue(legalConfig.locality)}>
            {legalConfig.locality}
          </span>
        </span>
        <span class:legal-missing={isMissingLegalValue(legalConfig.country)}>
          {legalConfig.country}
        </span>
      </address>
    </section>

    <section>
      <h2>Contact</h2>
      <dl>
        <div>
          <dt>Email</dt>
          <dd><a href={`mailto:${legalConfig.email}`}>{legalConfig.email}</a></dd>
        </div>
      </dl>
    </section>

    {#if legalConfig.disputeResolution}
      <section>
        <h2>Consumer dispute resolution</h2>
        <p>{legalConfig.disputeResolution}</p>
      </section>
    {/if}
  </main>
</div>
