<script lang="ts">
  import {
    hasMissingRequiredLegalValues,
    isMissingLegalValue,
    legalConfig,
  } from '$lib/legal-config';
  import { TERMS_EFFECTIVE_DATE, TERMS_VERSION } from '$lib/terms';
</script>

<svelte:head>
  <title>vESP.cloud — General Terms and Conditions (AGB)</title>
  <meta
    name="description"
    content="General Terms and Conditions for accounts, cloud services and build-credit purchases on vESP.cloud."
  />
</svelte:head>

<div class="legal-document">
  <header class="legal-document__header">
    <a href="/" class="legal-document__back">Back to App</a>
    <p class="legal-document__eyebrow">Contractual information</p>
    <h1>General Terms and Conditions (AGB)</h1>
    <p>Version {TERMS_VERSION} · Effective {TERMS_EFFECTIVE_DATE}</p>
  </header>

  <main class="legal-document__content">
    {#if hasMissingRequiredLegalValues}
      <aside class="legal-document__warning" role="alert">
        <strong>Not ready for publication</strong>
        <p>
          Required operator details are still missing. Configure the
          <code>PUBLIC_LEGAL_*</code> environment variables before making the service public.
        </p>
      </aside>
    {/if}

    <section>
      <h2>1. Provider and scope</h2>
      <p>These General Terms and Conditions govern the use of vESP.cloud and contracts with:</p>
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
        <span>Email: <a href={`mailto:${legalConfig.email}`}>{legalConfig.email}</a></span>
      </address>
      <p>
        They apply to registered accounts, use of the hosted editor and cloud services, and purchases
        of build credits. A consumer is a natural person acting predominantly outside their trade,
        business or profession. A business customer is a natural or legal person acting in the course
        of its trade, business or profession.
      </p>
      <p>
        Individually agreed terms take precedence. Conflicting terms supplied by a business customer
        apply only if we expressly accept them.
      </p>
    </section>

    <section>
      <h2>2. Registration and conclusion of contracts</h2>
      <p>
        To use account features, you must register with accurate information and accept these Terms.
        You must be at least 18 years old and legally capable of entering into the contract. By
        submitting the registration form, you make an offer to enter into a user agreement. The user
        agreement is concluded when we make the account available to you.
      </p>
      <p>
        Credit packs displayed on the service are invitations to place an order, not binding offers.
        You place a binding order using the final, clearly labelled payment button in Stripe Checkout.
        We accept the order when we confirm it or add the purchased credits to your account. Before
        submitting the order, you can review and correct the information shown in the checkout.
      </p>
      <p>
        The contract language is English. The current Terms can be viewed, saved and printed from this
        page.
      </p>
    </section>

    <section>
      <h2>3. The service</h2>
      <p>
        vESP.cloud provides a visual editor for ESPHome display projects. Depending on the features
        selected, you can store projects, generate configuration and source files, and request cloud
        compilation of firmware. The scope of a feature is described in the service when you use or
        purchase it.
      </p>
      <p>
        Generated configurations and firmware interact with hardware and third-party systems such as
        ESPHome and Home Assistant. You are responsible for checking configurations, keeping suitable
        backups, following the hardware manufacturer's instructions, and testing generated output in a
        safe environment before deployment. This does not limit our responsibility for providing the
        service in conformity with the contract or your statutory rights in the event of defects.
      </p>
    </section>

    <section>
      <h2>4. Account security and user obligations</h2>
      <p>
        You must keep your credentials confidential, protect access to your email account, and notify
        us promptly if you suspect unauthorised access. You are responsible for activity carried out
        through your account unless that activity is attributable to us or occurred without fault on
        your part.
      </p>
      <p>You must not use the service to:</p>
      <ul>
        <li>violate applicable law or third-party rights;</li>
        <li>upload malicious code or content that you are not entitled to use;</li>
        <li>interfere with the service, evade access or credit controls, or probe security without permission;</li>
        <li>use automated requests in a way that unreasonably impairs the service for others; or</li>
        <li>share, sell or transfer an account without our prior consent.</li>
      </ul>
    </section>

    <section>
      <h2>5. Projects, user content and generated output</h2>
      <p>
        You retain your rights in projects and other content you submit. You grant us a non-exclusive,
        worldwide licence, limited to the term and purposes of the contract, to host, copy, process and
        transmit that content as necessary to provide, secure and maintain the service. You confirm
        that you have the rights needed to submit the content.
      </p>
      <p>
        You may use and modify output generated for you, subject to any third-party or open-source
        licence notices contained in that output. The service, its interface and its independently
        created software remain protected by the applicable intellectual-property laws and licences.
      </p>
    </section>

    <section>
      <h2>6. Availability, maintenance and service changes</h2>
      <p>
        Unless we expressly agree otherwise, no particular uninterrupted availability or service level
        is guaranteed. Temporary interruptions may occur for maintenance, security, capacity or events
        outside our reasonable control. We will take reasonable care to keep interruptions proportionate.
      </p>
      <p>
        We may make reasonable changes required for security, legal compliance, technical compatibility
        or continued development. Changes will not remove statutory rights or reduce a purchased credit
        balance. If a change materially impairs an ongoing consumer contract, the statutory rules for
        changes to digital products apply.
      </p>
    </section>

    <section>
      <h2>7. Build credits, prices and payment</h2>
      <p>
        Build credits are prepaid units that can be used for the paid actions identified on the service.
        Unless stated otherwise before purchase, one credit currently covers one cloud firmware build.
        The description displayed before purchase prevails if the credit cost of a feature differs.
      </p>
      <p>
        Purchased credits do not expire, are not transferable, do not bear interest and are not a
        currency or general payment instrument. Free or promotional credits may be subject to separately
        disclosed conditions. Credits are deducted when a valid build request is accepted for processing.
        If a build cannot be provided solely because of a malfunction for which we are responsible,
        contact us so that we can verify the failure and restore the credit or provide another remedy.
        Statutory defect rights remain unaffected.
      </p>
      <p>
        The total price, currency, applicable taxes and accepted payment methods are displayed before
        you place an order. Payments are processed by Stripe. Credits are normally added after successful
        payment confirmation. There is no voluntary cash redemption of credits unless we expressly agree
        otherwise; statutory refund and withdrawal rights remain unaffected.
      </p>
    </section>

    <section>
      <h2>8. Right of withdrawal for consumers</h2>
      <p>
        Consumers generally have a statutory right of withdrawal for distance contracts. The applicable
        withdrawal instructions and the online withdrawal function are available on our
        <a href="/withdrawal">withdrawal page</a>.
      </p>
      <p>
        If you expressly request that a paid service begin during the withdrawal period, the law may
        require payment for the proportion already performed. A right of withdrawal expires early only
        where all statutory requirements are met. These Terms do not restrict your statutory right of
        withdrawal.
      </p>
    </section>

    <section>
      <h2>9. Term, account deletion and suspension</h2>
      <p>
        The user agreement runs for an indefinite period. You may terminate it at any time by deleting
        your account. Account deletion permanently removes account access, projects and the credit balance
        in accordance with the deletion notice. Use remaining purchased credits or contact us about them
        before deleting the account. Account deletion does not waive mandatory withdrawal, refund or
        defect claims.
      </p>
      <p>
        We may ordinarily terminate the free user agreement on 30 days' notice. If purchased credits
        remain, we will provide a reasonable opportunity to use them or deal with their attributable
        purchase price as required by law. Either party may terminate for good cause. Good cause for us
        may include a serious or repeated breach of section 4, non-payment or a material security risk.
      </p>
      <p>
        We may temporarily restrict an account where reasonably necessary to protect the service,
        investigate misuse or comply with law. Where appropriate, we will notify you and give you a
        reasonable opportunity to remedy the issue before restriction. Immediate action remains possible
        for urgent security, legal or abuse concerns.
      </p>
    </section>

    <section>
      <h2>10. Defects and support</h2>
      <p>
        Statutory rights concerning defective services and digital products apply. Please report a defect
        with enough information for us to reproduce it to
        <a href={`mailto:${legalConfig.email}`}>{legalConfig.email}</a>. Descriptions of third-party
        compatibility are not guarantees unless expressly identified as such.
      </p>
    </section>

    <section>
      <h2>11. Liability</h2>
      <p>
        We are liable without limitation for intent and gross negligence, for injury to life, body or
        health, under the German Product Liability Act, for fraudulently concealed defects, and under any
        guarantee expressly given by us.
      </p>
      <p>
        In cases of ordinary negligence, we are liable for breach of an essential contractual obligation
        whose performance makes the contract possible and on which you may ordinarily rely. In that case,
        liability is limited to the damage that was foreseeable and typical when the contract was made.
        Otherwise, liability for ordinary negligence is excluded to the extent permitted by law. These
        limitations also apply to our legal representatives and agents.
      </p>
    </section>

    <section>
      <h2>12. Data protection</h2>
      <p>
        Information about the processing of personal data is provided separately in our
        <a href="/privacy">Privacy Policy</a>. The Privacy Policy is information, not part of these
        contractual Terms.
      </p>
    </section>

    <section>
      <h2>13. Changes to these Terms</h2>
      <p>
        Revised Terms apply to new contracts from the effective date shown in the revised version. We
        will ask for your express agreement where a change is intended to alter an existing contract and
        consent is legally required. Statutory rights to change digital products remain unaffected.
      </p>
    </section>

    <section>
      <h2>14. Governing law and jurisdiction</h2>
      <p>
        German law applies, excluding the UN Convention on Contracts for the International Sale of Goods.
        If you are a consumer, this choice does not deprive you of mandatory protections of the country
        in which you habitually reside.
      </p>
      <p>
        If you are a merchant, a legal entity under public law or a special fund under public law, the
        courts at our registered place of business have jurisdiction to the extent permitted by law.
        Statutory rules otherwise determine jurisdiction.
      </p>
    </section>

    {#if legalConfig.disputeResolution}
      <section>
        <h2>15. Consumer dispute resolution</h2>
        <p>{legalConfig.disputeResolution}</p>
      </section>
    {/if}

    <section>
      <h2>{legalConfig.disputeResolution ? '16' : '15'}. Final provision</h2>
      <p>
        If an individual provision is invalid or unenforceable, the remaining provisions remain in
        effect. The invalid or unenforceable provision is replaced by the applicable statutory rule.
      </p>
    </section>
  </main>
</div>
