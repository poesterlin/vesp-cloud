<script lang="ts">
  import { page } from "$app/state";
  import "../app.css";

  let { children } = $props();

  const SITE_NAME = "vESP.cloud";
  const DEFAULT_DESCRIPTION =
    "Visual editor and cloud build platform for ESPHome smart home touch displays.";

  function getSeoForPath(pathname: string) {
    if (pathname === "/intro") {
      return {
        title: "vESP.cloud - Display Builder",
        description:
          "Design dashboards for Home Assistant, export firmware, and deploy updates with vESP.cloud.",
      };
    }

    if (pathname === "/home-assistant-entity-export") {
      return {
        title: "Home Assistant Entity Export - vESP.cloud",
        description:
          "Install HA Metadata Exporter with HACS and import your Home Assistant entities into vESP.cloud.",
      };
    }

    if (pathname === "/terms") {
      return {
        title: "Terms of Service - vESP.cloud",
        description:
          "Read the vESP.cloud terms for account usage, purchases, privacy, and consumer rights.",
      };
    }

    if (pathname === "/withdrawal") {
      return {
        title: "Right of Withdrawal - vESP.cloud",
        description:
          "Submit and track your statutory withdrawal request for vESP.cloud credit pack purchases.",
      };
    }

    return {
      title: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
    };
  }

  function isIndexablePath(pathname: string) {
    return pathname === "/intro" || pathname === "/home-assistant-entity-export" || pathname === "/terms" || pathname === "/withdrawal";
  }

  const seo = $derived(getSeoForPath(page.url.pathname));
  const indexable = $derived(isIndexablePath(page.url.pathname));
  const canonicalUrl = $derived(`${page.url.origin}${page.url.pathname}`);
  const ogImageUrl = $derived(`${page.url.origin}/display.jpg`);
</script>

<svelte:head>
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
