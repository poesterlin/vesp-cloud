<script lang="ts">
  import {
    hasMissingRequiredLegalValues,
    isMissingLegalValue,
    legalConfig,
  } from '$lib/legal-config';
</script>

<svelte:head>
  <title>vESP.cloud — Privacy Policy</title>
  <meta
    name="description"
    content="Information about how vESP.cloud processes personal data."
  />
</svelte:head>

<div class="legal-document">
  <header class="legal-document__header">
    <a href="/" class="legal-document__back">Back to App</a>
    <p class="legal-document__eyebrow">Data protection</p>
    <h1>Privacy Policy</h1>
    <p>Information pursuant to Articles 12–14 GDPR · Last updated July 20, 2026</p>
  </header>

  <main class="legal-document__content">
    {#if hasMissingRequiredLegalValues}
      <aside class="legal-document__warning" role="alert">
        <strong>Not ready for publication</strong>
        <p>
          Controller and retention details are still incomplete. Configure the
          <code>PUBLIC_LEGAL_*</code> values and have this notice reviewed before launch.
        </p>
      </aside>
    {/if}

    <section>
      <h2>1. Controller</h2>
      <p>The controller responsible for processing personal data through vESP.cloud is:</p>
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
        For a self-hosted installation operated by another person or organisation, that operator is
        generally the controller for processing performed by its installation.
      </p>
    </section>

    <section>
      <h2>2. Accessing the service and server logs</h2>
      <p>
        When you access the service, the web and hosting systems process technical request data. This
        can include your IP address, date and time, requested URL, HTTP method and status, referrer,
        browser or user-agent information, and diagnostic or security events. The processing is
        necessary to deliver the website, maintain reliable operation, prevent abuse and investigate
        faults.
      </p>
      <p>
        The legal basis is Article 6(1)(f) GDPR. Our legitimate interests are the secure, reliable and
        economical operation of the service. Security-relevant records may be retained longer where
        necessary to investigate an incident or establish, exercise or defend legal claims.
      </p>
      <p>
        The application server is operated directly by the controller. Public requests are routed
        through Cloudflare Tunnel. Cloudflare processes connection and request data such as IP
        addresses, timestamps, hostnames, request metadata and security events to deliver and protect
        the service. Cloudflare acts as a processor where applicable. This processing is based on
        Article 6(1)(f) GDPR; our legitimate interests are secure public connectivity, attack
        protection and service availability. Further information is available in
        <a href="https://www.cloudflare.com/privacypolicy/" rel="external">Cloudflare's privacy policy</a>.
      </p>
    </section>

    <section>
      <h2>3. Accounts and authentication</h2>
      <p>
        To create and operate an account, we process your username, email address, salted password
        hash, internal user ID, account creation date, last login, failed login attempts, temporary
        lock information, session identifier and session expiry. We also process password-reset tokens
        when you request account recovery.
      </p>
      <p>
        The legal basis is Article 6(1)(b) GDPR because this processing is required to create, secure
        and administer your account and provide the requested service. Abuse-prevention processing is
        also based on our legitimate security interest under Article 6(1)(f) GDPR.
      </p>
      <p>
        The username, email address and password are required to create a hosted account. Without
        them, we cannot provide the authenticated cloud service.
      </p>
    </section>

    <section>
      <h2>4. Projects, firmware builds and deployment</h2>
      <p>
        We store the projects you save, including project names, display configuration, widget
        settings, Home Assistant entity IDs referenced by widgets, update URLs and other values stored
        in the project model. We also process build configuration, build status, timestamps, compiler
        output and error logs, generated firmware files, deployment status and firmware access tokens.
      </p>
      <p>
        The legal basis is Article 6(1)(b) GDPR. The data is required to save projects, generate
        firmware, show build history and provide deployment downloads. Do not enter Wi-Fi passwords,
        Home Assistant access tokens or other unnecessary secrets into project names or editable
        fields.
      </p>
      <p>
        Generated firmware files are stored in a self-hosted MinIO object-storage instance operated
        by the controller on the controller's own infrastructure. No separate object-storage provider
        receives the files solely by virtue of that storage.
      </p>
    </section>

    <section>
      <h2>5. Home Assistant metadata stored in your browser</h2>
      <p>
        If you import a Home Assistant metadata export, the editor reads it in your browser and stores
        it in browser local storage under <code>vesp-cloud-homeassistant-dump</code>. It can contain
        entity IDs, friendly names, states, attributes, device names, areas and available services.
        The editor uses this information for search, autocomplete and preview values. The imported
        dump is not uploaded to the vESP.cloud server by the import feature. You can remove it from the
        editor or by clearing this site's browser data.
      </p>
      <p>
        Access to this browser storage is performed to provide the metadata import and editor features
        you request. The application also accesses legacy local project keys once to migrate projects
        from earlier browser-only versions to hosted project storage.
      </p>
    </section>

    <section>
      <h2>6. Cookies and other browser storage</h2>
      <p>
        After login, vESP.cloud stores an HTTP-only <code>auth-session</code> cookie. It is valid for up
        to 30 days, is sent only to this site, and is used to keep you signed in and protect account
        access. It is strictly necessary to provide the authenticated service requested by you.
      </p>
      <p>
        The editor also stores an <code>onboarding-dismissed</code> preference so a dismissed onboarding
        panel remains hidden, as well as the local Home Assistant and migration data described above.
        The application does not currently use advertising cookies.
      </p>
      <p>
        The GDPR legal bases are Article 6(1)(b) for storage required to provide the requested service
        and Article 6(1)(f) for secure session handling and user-interface continuity. Storage or access
        on your device is additionally assessed under § 25 TDDDG. The anonymized analytics described
        below does not set cookies or store an analytics identifier on your device. If marketing or
        other non-essential browser storage is introduced, it will not be activated without any consent
        that applicable law requires.
      </p>
    </section>

    <section>
      <h2>7. Anonymized usage analytics</h2>
      <p>
        We use Umami to understand how the service is found and which product features are useful. The
        analytics integration is configured without analytics cookies, advertising identifiers,
        cross-site tracking or user profiles. Search parameters and URL fragments are excluded from
        page-view collection so editor parameters are not included in analytics.
      </p>
      <p>
        We collect aggregated page views and technical usage information such as the visited route,
        referrer, approximate country, device type, operating system, browser and session duration. We
        also record selected product events, including account-form submissions, project creation,
        Home Assistant metadata-import outcomes, component types added to a project, firmware build
        starts, outcomes and duration, project-file downloads, opening the device-installation flow,
        checkout starts and successful returns, and successful feedback submissions.
      </p>
      <p>
        Analytics events do not contain usernames, email addresses, account or project IDs, project
        names, Home Assistant entity IDs, imported Home Assistant metadata, URLs entered into a project,
        file names, feedback text or payment details. The analytics web server necessarily receives
        connection data such as an IP address and user agent when your browser sends a request. Umami
        uses this information to produce non-identifying statistics; it is not included as a directly
        identifying value in the analytics reports or combined with account data by vESP.cloud.
      </p>
      <p>
        The intended legal basis is Article 6(1)(f) GDPR. Our legitimate interests are measuring the
        reach and usability of the service, identifying unsuccessful user journeys, prioritising product
        improvements and operating the service economically. You may object to this processing at any
        time by contacting <a href={`mailto:${legalConfig.email}`}>{legalConfig.email}</a>. Browser
        privacy or content-blocking tools can also prevent the analytics request. Further information
        about the software is available in
        <a href="https://umami.is/privacy" rel="external">Umami's privacy information</a>.
      </p>
    </section>

    <section>
      <h2>8. Payments, credits and withdrawals</h2>
      <p>
        Credit purchases are processed through Stripe. We process an internal user ID, Stripe customer
        and checkout IDs, selected price, payment status, amount, currency, credit balance and history,
        timestamps, and the record of any immediate-performance consent. Stripe processes payment and
        billing details under its own responsibility where applicable. vESP.cloud does not receive or
        store your complete payment-card number.
      </p>
      <p>
        For withdrawal requests, we process the order ID, account or contact email, purchased and used
        credits, payment amount, request status, timestamps and internal processing notes.
      </p>
      <p>
        The legal bases are Article 6(1)(b) GDPR for carrying out purchases and withdrawals, Article
        6(1)(c) GDPR for tax, accounting and consumer-law duties, and Article 6(1)(f) GDPR for preventing
        duplicate or fraudulent transactions and establishing, exercising or defending legal claims.
        See <a href="https://stripe.com/privacy" rel="external">Stripe's privacy policy</a> for further
        information about Stripe.
      </p>
    </section>

    <section>
      <h2>9. Transactional email, support and feedback</h2>
      <p>
        We use the email address associated with your account to send registration, account-recovery
        and withdrawal messages. When email delivery is configured, the recipient address, sender,
        message content and delivery metadata are transmitted to Resend, our transactional email
        provider. The legal bases are Article 6(1)(b) GDPR and, for service security and support,
        Article 6(1)(f) GDPR.
      </p>
      <p>
        If you submit feedback or contact support, we process your account reference, contact details,
        message, our reply and relevant timestamps. The legal basis is Article 6(1)(b) GDPR where the
        request concerns our contract and otherwise Article 6(1)(f) GDPR. Our legitimate interest is
        responding to requests and improving the service.
      </p>
    </section>

    <section>
      <h2>10. Error monitoring and external deployment component</h2>
      <p>
        Error monitoring uses a self-hosted Sentry backend operated by the controller. It processes
        technical error, trace and request information needed to diagnose failures. Error data is not
        sent to Sentry's hosted SaaS service. The legal basis is Article 6(1)(f) GDPR; our legitimate
        interest is finding and fixing service failures.
      </p>
      <p>
        The deployment page downloads the ESP Web Tools component from <code>unpkg.com</code>. The CDN
        therefore receives technical request data such as your IP address, user agent and referring
        page when that page loads. The intended legal basis is Article 6(1)(f) GDPR; our legitimate
        interest is providing browser-based device installation. This integration and any associated
        international transfer must be confirmed during the professional review; self-hosting the
        script should be considered.
      </p>
    </section>

    <section>
      <h2>11. Recipients and international transfers</h2>
      <p>
        Personal data is disclosed only where necessary to Cloudflare for public connectivity and
        security, Resend for transactional email, Stripe for payments, the configured Umami analytics
        operator where it is not operated directly by the controller, professional advisers, or public
        authorities where disclosure is legally required. The application server, database, MinIO
        storage and Sentry backend are self-hosted by the controller rather than operated by separate
        SaaS providers. Processors are contractually bound in accordance with Article 28 GDPR where
        applicable.
      </p>
      <p>
        Some providers may process data outside the European Economic Area. Where required, transfers
        are based on an adequacy decision under Article 45 GDPR or appropriate safeguards such as the
        European Commission's standard contractual clauses under Article 46 GDPR. The final list of
        providers, processing locations and transfer safeguards must be completed and verified before
        publication.
      </p>
    </section>

    <section>
      <h2>12. Retention and deletion</h2>
      <ul>
        <li>Account, session and project data is generally kept while your account remains active.</li>
        <li>Expired password-reset tokens and sessions are removed according to operational schedules.</li>
        <li>
          Application and container logs are stored in rotating storage limited to five files of up to
          20 MB per container. Older entries are automatically deleted when this limit is reached. The
          resulting retention period varies with log volume and the container lifecycle.
        </li>
        <li>
          Security-relevant records may be retained separately for longer where necessary to investigate
          an incident or establish, exercise or defend legal claims.
        </li>
        <li>
          Aggregated Umami analytics records are retained for the configured analytics retention period
          and are then deleted or anonymized. They are not linked to an account-deletion workflow because
          vESP.cloud does not attach account or project identifiers to analytics events.
        </li>
        <li>
          Build files, compiler records, support messages and error-monitoring events are retained only
          for their configured operational period or while needed for an unresolved issue.
        </li>
        <li>
          Payment, transaction and withdrawal records may be retained after account deletion for the
          applicable statutory tax, accounting, consumer-law and limitation periods.
        </li>
      </ul>
      <p>
        You can request account deletion from the account page. Browser-local information remains on
        your device until you remove it through the editor or your browser settings.
      </p>
    </section>

    <section>
      <h2>13. Your rights</h2>
      <p>Subject to the legal requirements, you have the right to:</p>
      <ul>
        <li>request access to and a copy of your personal data;</li>
        <li>request correction of inaccurate or incomplete data;</li>
        <li>request deletion or restriction of processing;</li>
        <li>receive data you provided in a portable format;</li>
        <li>object to processing based on Article 6(1)(f) GDPR; and</li>
        <li>withdraw consent at any time where processing is based on consent.</li>
      </ul>
      <p>
        To exercise these rights, contact <a href={`mailto:${legalConfig.email}`}>{legalConfig.email}</a>.
        A withdrawal of consent does not affect processing that was lawful before the withdrawal.
      </p>
    </section>

    <section>
      <h2>14. Right to complain</h2>
      <p>
        You may lodge a complaint with a data protection supervisory authority, in particular in the
        EU Member State of your habitual residence, place of work or the place of the alleged
        infringement. The authority competent for the controller is:
      </p>
      <p class:legal-missing={isMissingLegalValue(legalConfig.supervisoryAuthority)}>
        {legalConfig.supervisoryAuthority}
      </p>
    </section>

    <section>
      <h2>15. Automated decision-making</h2>
      <p>
        We do not use solely automated decision-making, including profiling, that produces legal or
        similarly significant effects within the meaning of Article 22 GDPR.
      </p>
    </section>

    <section>
      <h2>16. Changes to this notice</h2>
      <p>
        We may update this notice when the service, providers or legal requirements change. The current
        version and its revision date will remain available at this URL.
      </p>
    </section>
  </main>
</div>
