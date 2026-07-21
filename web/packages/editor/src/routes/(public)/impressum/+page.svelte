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

{#snippet operatorAddress()}
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
{/snippet}

{#snippet contactEntry(label: string)}
  <dl>
    <div>
      <dt>{label}</dt>
      <dd><a href={`mailto:${legalConfig.email}`}>{legalConfig.email}</a></dd>
    </div>
  </dl>
{/snippet}

{#snippet taxIdEntry()}
  <dl>
    <div>
      <dt>Steueridentifikationsnummer (Steuer-ID)</dt>
      <dd>{legalConfig.taxId}</dd>
    </div>
  </dl>
{/snippet}

<div class="legal-document">
  <header class="legal-document__header">
    <a href="/" class="legal-document__back">Back to App</a>
    <p class="legal-document__eyebrow">Legal information</p>
    <h1>Impressum</h1>
    <p>Angaben gemäß § 5 DDG · Provider identification pursuant to § 5 DDG</p>
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

    <h2 class="legal-document__language">Deutsch</h2>

    <section>
      <h2>Diensteanbieter</h2>
      {@render operatorAddress()}
    </section>

    <section>
      <h2>Kontakt</h2>
      {@render contactEntry('E-Mail')}
    </section>

    {#if legalConfig.taxId}
      <section>
        <h2>Steuerliche Identifikation</h2>
        {@render taxIdEntry()}
      </section>
    {/if}

    {#if legalConfig.disputeResolution}
      <section>
        <h2>Verbraucherstreitbeilegung</h2>
        <p>{legalConfig.disputeResolution}</p>
      </section>
    {/if}

    <h2 class="legal-document__language">English</h2>

    <section>
      <h2>Service provider</h2>
      {@render operatorAddress()}
    </section>

    <section>
      <h2>Contact</h2>
      {@render contactEntry('Email')}
    </section>

    {#if legalConfig.taxId}
      <section>
        <h2>Tax identification</h2>
        {@render taxIdEntry()}
      </section>
    {/if}

    {#if legalConfig.disputeResolution}
      <section>
        <h2>Consumer dispute resolution</h2>
        <p>{legalConfig.disputeResolution}</p>
      </section>
    {/if}
  </main>
</div>
