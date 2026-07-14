<script lang="ts">
  import { fly, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import * as mdiIcons from "@mdi/js";
  import logo1024 from "@vesp-cloud/assets/logo-1024x1024.jpg";
  import homeEditor from "@vesp-cloud/assets/imgs/examples/home-editor.webp";
  import homeDisplay from "@vesp-cloud/assets/imgs/examples/home-display.png";
  import homeDisplayModern from "@vesp-cloud/assets/imgs/examples/home-display-modern.png";
  import vacuumEditor from "@vesp-cloud/assets/imgs/examples/vacuum-editor.webp";
  import vacuumDisplay from "@vesp-cloud/assets/imgs/examples/vacuum-display.png";
  import vacuumDisplayModern from "@vesp-cloud/assets/imgs/examples/vacuum-display-modern.png";
  import weatherEditor from "@vesp-cloud/assets/imgs/examples/weather-editor.webp";
  import weatherDisplay from "@vesp-cloud/assets/imgs/examples/weather-display.png";
  import weatherDisplayModern from "@vesp-cloud/assets/imgs/examples/weather-display-modern.png";

  let { data } = $props();
  type GalleryMode = 0 | 1 | 2;

  let galleryMode = $state<GalleryMode>(0);

  const galleryModes: { label: string; value: GalleryMode }[] = [
    { label: "Web Editor", value: 0 },
    { label: "Retro Theme", value: 1 },
    { label: "Modern Theme", value: 2 },
  ];

  const currency = Intl.NumberFormat("us", {
    style: "currency",
    currency: "EUR",
    compactDisplay: "long",
    minimumFractionDigits: 2,
    currencyDisplay: "symbol",
  });

  function fmt(amount: number) {
    return currency.format(amount);
  }

  const examples = [
    {
      name: "Home",
      images: [
        { src: homeEditor, alt: "Home dashboard in the vESP.cloud editor" },
        { src: homeDisplay, alt: "Home dashboard running on the display" },
        {
          src: homeDisplayModern,
          alt: "Home dashboard running on the display with the modern theme",
        },
      ],
    },
    {
      name: "Vacuum",
      images: [
        { src: vacuumEditor, alt: "Vacuum dashboard in the vESP.cloud editor" },
        { src: vacuumDisplay, alt: "Vacuum dashboard running on the display" },
        {
          src: vacuumDisplayModern,
          alt: "Vacuum dashboard running on the display with the modern theme",
        },
      ],
    },
    {
      name: "Weather",
      images: [
        {
          src: weatherEditor,
          alt: "Weather dashboard in the vESP.cloud editor",
        },
        {
          src: weatherDisplay,
          alt: "Weather dashboard running on the display",
        },
        {
          src: weatherDisplayModern,
          alt: "Weather dashboard running on the display with the modern theme",
        },
      ],
    },
  ] as const;
</script>

<svelte:head>
  <title>vESP.cloud — Introduction</title>
</svelte:head>

<div class="intro-page">
  <header in:fly={{ y: -20, duration: 800, easing: cubicOut }}>
    {#if data.user}
      <div class="user-bar">
        <span class="user-name">{data.user.username}</span>
        <a href="/" class="user-link">
          <svg width="14" height="14" viewBox="0 0 24 24" class="icon">
            <path d={mdiIcons.mdiHome} />
          </svg>
          Dashboard
        </a>
        <form action="/logout" method="post" class="logout-form">
          <button type="submit" class="user-link logout-link">Logout</button>
        </form>
      </div>
    {/if}
    <div class="brand-lockup">
      <img src={logo1024} alt="vESP.cloud" class="brand-mark" />
      <div class="brand-copy">
        <h1>All the control<br /><span>Affordable hardware</span></h1>
        <p>Design a Home Assistant display that runs directly on an ESP32.</p>
      </div>
    </div>
  </header>

  <main>
    <section
      class="card"
      in:scale={{ start: 0.95, delay: 200, duration: 500, easing: cubicOut }}
    >
      <div class="block hardware">
        <div class="block-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" class="icon">
            <path d={mdiIcons.mdiMonitorScreenshot} />
          </svg>
        </div>
        <div class="block-content">
          <h2>What You'll Need</h2>
          <div class="hardware-layout">
            <div class="hardware-image-slot">
              <img
                class="hardware-image"
                src="/display.jpg"
                alt="Guition ESP32-S3-4848S040 display"
                loading="lazy"
              />
              <!-- Add more device photos below -->
            </div>
            <div class="hardware-info">
              <a
                href="https://aliexpress.com/item/1005006622746590.html"
                target="_blank"
                class="name-link"
              >
                <strong class="hardware-name">Guition ESP32-S3</strong>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  class="icon ext-icon"
                >
                  <path d={mdiIcons.mdiOpenInNew} />
                </svg>
              </a>
              <span class="spec">480 &times; 480 pixel display</span>
              <span class="desc"
                >ESP32-S3 with integrated touch display, USB-C, and Wi-Fi
                connectivity</span
              >
              <span class="price">&sim;{fmt(20)}</span>
              <a
                href="https://youtu.be/youtube-video-id"
                target="_blank"
                class="demo-link"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" class="icon">
                  <path d={mdiIcons.mdiYoutube} />
                </svg>
                Display demo
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  class="icon ext-icon"
                >
                  <path d={mdiIcons.mdiOpenInNew} />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="block photos">
        <div class="block-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" class="icon">
            <path d={mdiIcons.mdiCamera} />
          </svg>
        </div>
        <div class="block-content">
          <h2>Working Device</h2>
          <p>See each dashboard in the editor and running on the device.</p>
          <div class="gallery-mode-selector" aria-label="Gallery mode">
            {#each galleryModes as mode}
              <button
                type="button"
                class:active={galleryMode === mode.value}
                aria-pressed={galleryMode === mode.value}
                onclick={() => (galleryMode = mode.value)}
              >
                {mode.label}
              </button>
            {/each}
          </div>
          <div class="photo-grid">
            {#each examples as example}
              {@const image = example.images[galleryMode]}
              <figure class="photo-card">
                <div class="photo-stage">
                  <img
                    src={image.src}
                    alt={image.alt}
                    class="photo"
                    width="640"
                    height="640"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </figure>
            {/each}
          </div>
        </div>
      </div>

      <div class="block">
        <div class="block-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" class="icon">
            <path d={mdiIcons.mdiInformationOutline} />
          </svg>
        </div>
        <div class="block-content">
          <h2>How It Works</h2>
          <div class="workflow-columns">
            <div class="option">
              <div class="option-header">
                <svg width="20" height="20" viewBox="0 0 24 24" class="icon">
                  <path d={mdiIcons.mdiDownload} />
                </svg>
                <h3>Self-Hosted ESPHome</h3>
              </div>
              <p>
                Download the generated code and flash it with your own ESPHome
                setup. <strong>Completely free</strong> &mdash; the code is yours
                to keep, modify, and run however you like.
              </p>
            </div>
            <div class="option">
              <div class="option-header">
                <svg width="20" height="20" viewBox="0 0 24 24" class="icon">
                  <path d={mdiIcons.mdiCloud} />
                </svg>
                <h3>Cloud Builds &amp; OTA Updates</h3>
              </div>
              <p>
                Design your dashboard, click build, and flash wirelessly. <strong
                  >1 credit per build</strong
                > &mdash; the most convenient way.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="block pricing">
        <div class="block-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" class="icon">
            <path d={mdiIcons.mdiCashMultiple} />
          </svg>
        </div>
        <div class="block-content">
          <h2>Pricing</h2>
          <p class="pricing-intro">
            Credits are only needed for cloud builds and OTA updates.
            Self-hosted ESPHome usage is completely free.
          </p>
          <div class="pricing-grid">
            {#each data.creditPacks as pack}
              <div
                class="pricing-card {pack.name === 'Builder'
                  ? 'highlight'
                  : ''}"
              >
                {#if pack.name === "Builder"}
                  <span class="badge">Best Value</span>
                {/if}
                <h3>{pack.name}</h3>
                <div class="credit-count">{pack.credits}</div>
                <div class="credit-label">builds</div>
                <div class="pack-price">{fmt(pack.price)}</div>
                <div class="per-credit">
                  {fmt(pack.price / pack.credits)} per build
                </div>
              </div>
            {/each}
          </div>
          <p class="pricing-note">
            No subscription. Pay only for what you use.
            <a href="/terms" class="terms-link">Terms of Service</a>. You may
            <a href="/withdrawal" class="terms-link"
              >withdraw from your purchase</a
            >.
          </p>
        </div>
      </div>

      <div class="block privacy">
        <div class="block-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" class="icon">
            <path d={mdiIcons.mdiShieldCheck} />
          </svg>
        </div>
        <div class="block-content">
          <h2>Your Data Stays Yours</h2>
          <p>
            We do <b>not</b> collect your Wi-Fi authentication details, Home Assistant
            access tokens, or similar connection secrets through this service. Wi-Fi
            setup is handled entirely by the device. Your network credentials never
            leave your home.
          </p>
        </div>
      </div>

      <div class="block hacs">
        <div class="block-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" class="icon">
            <path d={mdiIcons.mdiHomeAssistant} />
          </svg>
        </div>
        <div class="block-content">
          <h2>Recommended: HACS Integration</h2>
          <p>
            A Home Assistant integration that makes looking up entity IDs simple
            and gives the editor real example data to work with. <em
              >Strongly recommended.</em
            >
          </p>
          <ol class="steps">
            <li>
              <span class="step-badge">1</span> Open HACS →
              <strong>Integrations → Custom repositories</strong>
            </li>
            <li>
              <span class="step-badge">2</span> Add
              <code>https://github.com/poesterlin/ha-metadata-exporter</code>
              as an <strong>Integration</strong> repository
            </li>
            <li>
              <span class="step-badge">3</span> Install
              <strong>HA Metadata Exporter</strong> and restart Home Assistant
            </li>
            <li>
              <span class="step-badge">4</span> Navigate to the dashboard it creates
              in Home Assistant
            </li>
            <li>
              <span class="step-badge">5</span> Use
              <strong>Download metadata</strong> to export a JSON file
            </li>
            <li>
              <span class="step-badge">6</span> Drag the file into the editor to
              populate entities &amp; devices
            </li>
          </ol>
          <a class="hacs-guide-link" href="/home-assistant-entity-export">
            Read the full installation and entity export guide
            <svg width="16" height="16" viewBox="0 0 24 24" class="icon">
              <path d={mdiIcons.mdiArrowRight} />
            </svg>
          </a>
        </div>
      </div>
    </section>

    {#if !data.user}
      <section
        class="cta"
        in:scale={{ start: 0.95, delay: 800, duration: 500, easing: cubicOut }}
      >
        <h2>Ready to get started?</h2>
        <p>
          Create a free account and build your first smart home display today.
        </p>
        <div class="cta-actions">
          <a href="/register" class="btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" class="icon">
              <path d={mdiIcons.mdiAccountPlus} />
            </svg>
            Create Account
          </a>
          <a href="/login" class="btn-outline">
            <svg width="18" height="18" viewBox="0 0 24 24" class="icon">
              <path d={mdiIcons.mdiLogin} />
            </svg>
            Sign In
          </a>
        </div>
      </section>
    {:else}
      <section
        class="cta"
        in:scale={{ start: 0.95, delay: 800, duration: 500, easing: cubicOut }}
      >
        <a href="/" class="btn-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" class="icon">
            <path d={mdiIcons.mdiHome} />
          </svg>
          Go to Dashboard
        </a>
        <a
          href="https://youtu.be/youtube-video-id"
          target="_blank"
          class="tutorial-link"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" class="icon">
            <path d={mdiIcons.mdiSchool} />
          </svg>
          Setup tutorial
          <svg width="12" height="12" viewBox="0 0 24 24" class="icon ext-icon">
            <path d={mdiIcons.mdiOpenInNew} />
          </svg>
        </a>
      </section>
    {/if}
  </main>
</div>

<style>
  .intro-page {
    position: relative;
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem var(--spacing-xl) 6rem;
    min-height: 100vh;
  }

  .intro-page::before {
    content: "";
    position: fixed;
    inset: 0;
    z-index: -2;
    pointer-events: none;
    background-image: linear-gradient(
        rgba(83, 196, 202, 0.035) 1px,
        transparent 1px
      ),
      linear-gradient(90deg, rgba(83, 196, 202, 0.035) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: linear-gradient(to bottom, black, transparent 60%);
  }

  header {
    margin-bottom: 3rem;
  }

  h1 {
    font-size: clamp(2.35rem, 5vw, 4rem);
    font-weight: 800;
    margin-bottom: var(--spacing-sm);
    color: #fff;
    letter-spacing: -0.045em;
    line-height: 0.98;
  }

  h1 span {
    color: #53c4ca;
  }

  header p {
    color: var(--color-text-secondary);
    font-size: 1.25rem;
    font-weight: 400;
    opacity: 0.8;
  }

  .brand-lockup {
    display: grid;
    grid-template-columns: 180px 1fr;
    align-items: center;
    gap: 2.75rem;
    padding: 2rem 0 3rem;
    border-bottom: 1px solid rgba(83, 196, 202, 0.18);
  }

  .brand-mark {
    width: 180px;
    aspect-ratio: 1;
    border-radius: 26px;
    object-fit: cover;
    box-shadow:
      0 18px 60px rgba(0, 0, 0, 0.45),
      0 0 40px rgba(241, 36, 112, 0.08);
  }

  .brand-copy {
    text-align: left;
  }

  .eyebrow {
    display: block;
    margin-bottom: 0.8rem;
    color: #f1b829;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .user-bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .user-name {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
  }

  .user-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: 0.85rem;
    padding: 0.35rem 0.75rem;
    border-radius: 0.5rem;
    transition: all var(--transition-fast);
  }

  .user-link:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.06);
  }

  .logout-link {
    background: none;
    border: none;
    cursor: pointer;
  }

  .logout-form {
    display: inline;
    margin: 0;
    padding: 0;
  }

  main {
    display: flex;
    flex-direction: column;
    gap: 3rem;
  }

  .card {
    background: #161616;
    border: 1px solid rgba(83, 196, 202, 0.18);
    border-radius: 1.25rem;
    overflow: hidden;
  }

  .block {
    display: flex;
    gap: 1.25rem;
    padding: 2rem 2.5rem;
    background: #1a1a1a;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    transition: border-color 0.2s;
  }

  .block:last-child {
    border-bottom: none;
  }

  .block:first-child {
    padding-top: 2.5rem;
  }

  .block:last-child {
    padding-bottom: 2.5rem;
  }

  .block:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .block-icon {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(83, 196, 202, 0.1);
    border-radius: 0.75rem;
    color: #53c4ca;
  }

  .block-content {
    flex: 1;
    min-width: 0;
  }

  .block-content h2 {
    font-size: 1.3rem;
    font-weight: 600;
    color: #fff;
    margin-bottom: 0.75rem;
  }

  .block-content h3 {
    font-size: 1.05rem;
    font-weight: 600;
    color: #fff;
  }

  .block-content p {
    color: var(--color-text-secondary);
    font-size: 1rem;
    line-height: 1.65;
  }

  .hacs-guide-link {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    margin-top: 1.25rem;
    color: #53c4ca;
    font-weight: 600;
    text-decoration: none;
  }

  .hacs-guide-link:hover {
    color: #7bd9dd;
  }

  .icon {
    fill: currentColor;
    stroke: none;
  }

  .hardware-layout {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .hardware-image-slot {
    flex-shrink: 0;
  }

  .hardware-image {
    width: 200px;
    height: auto;
    border-radius: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .hardware-info {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .name-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: currentColor;
    text-decoration: none;
  }

  .name-link:hover .hardware-name {
    color: var(--color-accent);
  }

  .name-link:hover .ext-icon {
    opacity: 1;
    color: var(--color-accent);
  }

  .hardware-name {
    font-size: 1.18rem;
    color: #fff;
    transition: color 0.2s;
  }

  .spec {
    color: var(--color-text-secondary);
    font-size: 0.96rem;
  }

  .desc {
    color: #909090;
    font-size: 0.92rem;
    line-height: 1.55;
  }

  .price {
    color: var(--color-accent);
    font-weight: 600;
    font-size: 1rem;
  }

  .ext-icon {
    opacity: 0.5;
    transition:
      opacity 0.2s,
      color 0.2s;
    flex-shrink: 0;
  }

  .demo-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.95rem;
    color: var(--color-text-secondary);
    text-decoration: none;
    margin-top: 0.25rem;
  }

  .demo-link:hover {
    color: #ff0000;
  }

  .demo-link:hover .ext-icon {
    opacity: 1;
    color: #ff0000;
  }

  .photo-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  .gallery-mode-selector {
    display: inline-flex;
    gap: 0.25rem;
    padding: 0.25rem;
    margin-top: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.65rem;
    background: #121212;
  }

  .gallery-mode-selector button {
    padding: 0.5rem 0.9rem;
    border: 0;
    border-radius: 0.45rem;
    background: transparent;
    color: var(--color-text-secondary);
    font: inherit;
    font-size: 0.9rem;
    cursor: pointer;
    transition:
      color 0.2s,
      background 0.2s;
  }

  .gallery-mode-selector button:hover {
    color: var(--color-text-primary);
  }

  .gallery-mode-selector button:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .gallery-mode-selector button.active {
    background: var(--color-accent);
    color: #0d0d0d;
  }

  .photo-card:last-child {
    width: calc((100% - 1rem) / 2);
    grid-column: 1 / -1;
    justify-self: center;
  }

  .photo-card {
    min-width: 0;
    margin: 0;
    background: #121212;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.75rem;
    overflow: hidden;
  }

  .photo-stage {
    position: relative;
    aspect-ratio: 1;
    background: #0d0d0d;
  }

  .photo {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .workflow-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .option {
    padding: 1.25rem;
    border-radius: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: #121212;
  }

  .option-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    color: var(--color-accent);
  }

  .option p {
    font-size: 0.95rem;
    color: var(--color-text-secondary);
    line-height: 1.6;
  }

  .option p strong {
    color: #fff;
  }

  .pricing .block-icon {
    background: rgba(255, 152, 0, 0.1);
    color: #ff9800;
  }

  .photos .block-icon {
    background: rgba(241, 36, 112, 0.1);
    color: #f12470;
  }

  .pricing-intro {
    margin-bottom: 1rem;
  }

  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  .pricing-card {
    position: relative;
    padding: 1.5rem 1.25rem;
    background: #121212;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 0.75rem;
    text-align: center;
    transition: all 0.2s;
  }

  .pricing-card.highlight {
    border-color: rgba(74, 158, 254, 0.3);
    background: rgba(74, 158, 254, 0.05);
    transform: scale(1.03);
  }

  .pricing-card .badge {
    position: absolute;
    top: -0.6rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-accent);
    color: #fff;
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.2rem 0.75rem;
    border-radius: 99px;
    white-space: nowrap;
  }

  .pricing-card h3 {
    margin-bottom: 0.75rem;
  }

  .credit-count {
    font-size: 2rem;
    font-weight: 800;
    color: #fff;
    line-height: 1;
  }

  .credit-label {
    font-size: 0.82rem;
    color: #909090;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.75rem;
  }

  .pack-price {
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--color-accent);
    margin-bottom: 0.25rem;
  }

  .per-credit {
    font-size: 0.85rem;
    color: #909090;
  }

  .pricing-note {
    margin-top: 1rem;
    font-size: 0.95rem;
    line-height: 1.6;
    text-align: center;
  }

  .privacy .block-icon {
    background: rgba(74, 222, 128, 0.1);
    color: #4ade80;
  }

  .privacy {
    border-color: rgba(74, 222, 128, 0.1);
  }

  .privacy:hover {
    border-color: rgba(74, 222, 128, 0.2);
  }

  .steps {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .steps li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--color-text-secondary);
  }

  .steps li strong {
    color: #fff;
  }

  .steps li code {
    font-family: var(
      --font-mono,
      ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace
    );
    font-size: 0.88rem;
    color: var(--color-accent);
    background: rgba(74, 158, 254, 0.1);
    padding: 0.15rem 0.4rem;
    border-radius: 0.35rem;
    word-break: break-all;
  }

  .step-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(74, 158, 254, 0.15);
    color: var(--color-accent);
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .cta {
    text-align: center;
    padding: 3rem 2rem;
    background: #161616;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 1.25rem;
  }

  .cta h2 {
    font-size: 1.75rem;
    font-weight: 700;
    color: #fff;
    margin-bottom: 0.5rem;
  }

  .cta p {
    color: var(--color-text-secondary);
    font-size: 1rem;
    margin-bottom: 2rem;
  }

  .cta-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.85rem 2rem;
    font-size: 1rem;
    font-weight: 600;
    border-radius: var(--radius-lg);
    background: var(--color-accent);
    color: #fff;
    text-decoration: none;
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .btn-primary:hover {
    background: var(--color-accent-hover);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(74, 158, 254, 0.25);
  }

  .btn-outline {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.85rem 2rem;
    font-size: 1rem;
    font-weight: 600;
    border-radius: var(--radius-lg);
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: var(--color-text-secondary);
    text-decoration: none;
    transition: all 0.2s;
  }

  .btn-outline:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.25);
    color: #fff;
  }

  .tutorial-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    padding: 0.6rem 1rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.75rem;
    text-decoration: none;
    transition: all 0.2s;
  }

  .tutorial-link:hover {
    color: #ff0000;
    border-color: rgba(255, 0, 0, 0.2);
    background: rgba(255, 0, 0, 0.05);
  }

  .tutorial-link:hover .ext-icon {
    opacity: 1;
    color: #ff0000;
  }

  .terms-link {
    color: var(--color-text-muted);
    text-decoration: underline;
    transition: color 0.2s;
  }

  .terms-link:hover {
    color: #fff;
  }

  @media (max-width: 768px) {
    .intro-page {
      padding: 2rem var(--spacing-md) 4rem;
    }

    h1 {
      font-size: 2.25rem;
    }

    .brand-lockup {
      grid-template-columns: 88px 1fr;
      gap: 1.25rem;
      padding-bottom: 2rem;
    }

    .brand-mark {
      width: 88px;
      border-radius: 16px;
    }

    header p {
      font-size: 0.95rem;
    }

    .block {
      padding: 1.5rem;
    }

    .block:first-child {
      padding-top: 2rem;
    }

    .block:last-child {
      padding-bottom: 2rem;
    }

    .hardware-layout {
      flex-direction: column;
    }

    .hardware-image {
      width: 100%;
      max-width: 240px;
    }

    .workflow-columns {
      grid-template-columns: 1fr;
    }

    .pricing-grid {
      grid-template-columns: 1fr;
    }

    .pricing-card.highlight {
      transform: none;
    }

    .photo-grid {
      grid-template-columns: 1fr;
    }

    .photo-card:last-child {
      width: 100%;
      grid-column: auto;
    }
  }
</style>
