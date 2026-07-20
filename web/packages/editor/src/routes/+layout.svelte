<script lang="ts">
  import { page } from "$app/state";
  import { env } from "$env/dynamic/public";
  import "../app.css";

  let { children, data } = $props();

  const SITE_NAME = "vESP.cloud";
  const DEFAULT_DESCRIPTION =
    "Visual editor and cloud build platform for ESPHome smart home touch displays.";

  function getSeoForPath(pathname: string) {
    if (pathname === "/intro") {
      return {
        title: "vESP.cloud — Intro",
        description:
          "Design dashboards for Home Assistant, export firmware, and deploy updates with vESP.cloud.",
      };
    }

    if (pathname === "/home-assistant-entity-export") {
      return {
        title: "vESP.cloud — Import",
        description:
          "Install HA Metadata Exporter with HACS and import your Home Assistant entities into vESP.cloud.",
      };
    }

    if (pathname === "/terms") {
      return {
        title: "vESP.cloud — General Terms and Conditions (AGB)",
        description:
          "Read the vESP.cloud General Terms and Conditions for accounts, cloud services and build credits.",
      };
    }

    if (pathname === "/impressum") {
      return {
        title: "vESP.cloud — Impressum",
        description: "Provider identification and legal contact information for vESP.cloud.",
      };
    }

    if (pathname === "/privacy") {
      return {
        title: "vESP.cloud — Privacy Policy",
        description: "Information about how vESP.cloud processes personal data.",
      };
    }

    if (pathname === "/withdrawal") {
      return {
        title: "vESP.cloud — Withdrawal",
        description:
          "Submit and track your statutory withdrawal request for vESP.cloud credit pack purchases.",
      };
    }

    return {
      title: "vESP.cloud — Builder",
      description: DEFAULT_DESCRIPTION,
    };
  }

  function isIndexablePath(pathname: string) {
    return pathname === "/intro" || pathname === "/home-assistant-entity-export" || pathname === "/terms" || pathname === "/impressum" || pathname === "/privacy" || pathname === "/withdrawal";
  }

  const seo = $derived(getSeoForPath(page.url.pathname));
  const indexable = $derived(isIndexablePath(page.url.pathname));
  const canonicalUrl = $derived(`${page.url.origin}${page.url.pathname}`);
  const ogImageUrl = $derived(`${page.url.origin}/display.jpg`);
  const analyticsEnabled = $derived(
    Boolean(env.PUBLIC_ANALYTICS_SCRIPT_URL && env.PUBLIC_ANALYTICS_WEBSITE_ID),
  );
</script>

<svelte:head>
  {#if analyticsEnabled}
    <script
      defer
      src={env.PUBLIC_ANALYTICS_SCRIPT_URL}
      data-website-id={env.PUBLIC_ANALYTICS_WEBSITE_ID}
      data-exclude-search="true"
      data-exclude-hash="true"
    ></script>
  {/if}
  <title>{seo.title}</title>
  <meta name="description" content={seo.description} />
  <meta name="robots" content={indexable ? "index, follow" : "noindex, nofollow"} />
  <link rel="canonical" href={canonicalUrl} />

  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:type" content="website" />
  <meta property="og:title" content={seo.title} />
  <meta property="og:description" content={seo.description} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={ogImageUrl} />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={seo.title} />
  <meta name="twitter:description" content={seo.description} />
  <meta name="twitter:image" content={ogImageUrl} />
</svelte:head>

{@render children()}

{#if data.showCloudLegalPages}
  <footer class="legal-footer">
    <nav aria-label="Legal information">
      <a href="/impressum">Impressum</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">AGB</a>
    </nav>
  </footer>
{/if}

<style>
  .legal-footer {
    position: fixed;
    right: 0.75rem;
    bottom: 0.65rem;
    z-index: 900;
    padding: 0.35rem 0.55rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    background: rgba(20, 20, 20, 0.9);
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.28);
    backdrop-filter: blur(8px);
  }

  .legal-footer nav {
    display: flex;
    align-items: center;
    gap: 0.7rem;
  }

  .legal-footer a {
    color: #b8b8b8;
    font-size: 0.72rem;
    line-height: 1;
    text-decoration: none;
  }

  .legal-footer a:hover,
  .legal-footer a:focus-visible {
    color: #fff;
    text-decoration: underline;
  }

  @media (max-width: 520px) {
    .legal-footer {
      right: 50%;
      bottom: 0.5rem;
      transform: translateX(50%);
    }
  }

  @media print {
    .legal-footer {
      display: none;
    }
  }
</style>
