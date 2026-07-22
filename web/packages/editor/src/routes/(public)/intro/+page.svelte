<script lang="ts">
  import { onMount } from 'svelte';
  import * as mdiIcons from '@mdi/js';
  import logo1024 from '@vesp-cloud/assets/logo-1024x1024.webp';
  import homeEditor from '@vesp-cloud/assets/imgs/examples/home-editor.webp';
  import homeDisplay from '@vesp-cloud/assets/imgs/examples/home-display.png';
  import homeDisplayModern from '@vesp-cloud/assets/imgs/examples/home-display-modern.png';
  import vacuumEditor from '@vesp-cloud/assets/imgs/examples/vacuum-editor.webp';
  import vacuumDisplay from '@vesp-cloud/assets/imgs/examples/vacuum-display.png';
  import vacuumDisplayModern from '@vesp-cloud/assets/imgs/examples/vacuum-display-modern.png';
  import weatherEditor from '@vesp-cloud/assets/imgs/examples/weather-editor.webp';
  import weatherDisplay from '@vesp-cloud/assets/imgs/examples/weather-display.png';
  import weatherDisplayModern from '@vesp-cloud/assets/imgs/examples/weather-display-modern.png';

  let { data } = $props();

  type GalleryMode = 0 | 1 | 2;
  let galleryMode = $state<GalleryMode>(1);
  let galleryTimerPhase = $state(false);
  let galleryTimer: ReturnType<typeof setTimeout> | undefined;
  let galleryAutoRotate = false;

  function scheduleGalleryRotation() {
    if (galleryTimer) clearTimeout(galleryTimer);
    galleryTimerPhase = !galleryTimerPhase;
    galleryTimer = setTimeout(() => {
      galleryMode = ((galleryMode + 1) % galleryModes.length) as GalleryMode;
      scheduleGalleryRotation();
    }, 6000);
  }

  function selectGalleryMode(mode: GalleryMode) {
    galleryMode = mode;
    if (galleryAutoRotate) scheduleGalleryRotation();
  }

  const galleryModes = [
    {
      label: 'Editor view',
      caption: 'In the browser editor',
      description: 'This is how each dashboard looks while you design and arrange it in the visual web editor.',
      value: 0
    },
    {
      label: 'Device · Retro',
      caption: 'On device · Retro theme',
      description: 'This is the finished dashboard running on the physical display with the Retro theme.',
      value: 1
    },
    {
      label: 'Device · Modern',
      caption: 'On device · Modern theme',
      description: 'This is the same dashboard running on the physical display with the Modern theme.',
      value: 2
    }
  ] as const satisfies readonly {
    label: string;
    caption: string;
    description: string;
    value: GalleryMode;
  }[];

  const examples = [
    {
      name: 'Home',
      images: [
        { src: homeEditor, alt: 'Home dashboard in the vESP.cloud editor' },
        { src: homeDisplay, alt: 'Retro home dashboard running on the display' },
        { src: homeDisplayModern, alt: 'Modern home dashboard running on the display' }
      ]
    },
    {
      name: 'Vacuum',
      images: [
        { src: vacuumEditor, alt: 'Vacuum dashboard in the vESP.cloud editor' },
        { src: vacuumDisplay, alt: 'Retro vacuum dashboard running on the display' },
        { src: vacuumDisplayModern, alt: 'Modern vacuum dashboard running on the display' }
      ]
    },
    {
      name: 'Weather',
      images: [
        { src: weatherEditor, alt: 'Weather dashboard in the vESP.cloud editor' },
        { src: weatherDisplay, alt: 'Retro weather dashboard running on the display' },
        { src: weatherDisplayModern, alt: 'Modern weather dashboard running on the display' }
      ]
    }
  ] as const;

  onMount(() => {
    galleryAutoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (galleryAutoRotate) {
      scheduleGalleryRotation();
    }

    return () => {
      if (galleryTimer) clearTimeout(galleryTimer);
    };
  });
</script>

<svelte:head>
  <title>vESP.cloud — Design your Home Assistant display</title>
  <meta
    name="description"
    content="Design a custom ESP32 Home Assistant display for free. No email required to create an account."
  />
</svelte:head>

<div class="intro-page">
  <nav aria-label="Main navigation">
    <a href="/intro" class="brand" aria-label="vESP.cloud introduction">
      <img src={logo1024} alt="" />
      <span>vESP.cloud</span>
    </a>

    <div class="nav-actions">
      <a href="https://docs.vesp.cloud" target="_blank" rel="noopener">Docs</a>
      {#if data.user}
        <a href="/" class="nav-primary">Open editor</a>
      {:else}
        <a href="/login">Sign in</a>
        <a href="/register" class="nav-primary">Lets go</a>
      {/if}
    </div>
  </nav>

  <main>
    <section class="hero">
      <div class="hero-copy">
        <h1>All the control<br /><span>Affordable hardware</span></h1>
        <p class="hero-lede">
          Design a beautiful touch dashboard in your browser and run it on an affordable ESP32
          display.
        </p>

        <div class="trust-row" aria-label="Account benefits">
          <span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiIcons.mdiCheckCircle} /></svg>
            Free to use
          </span>
          <span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiIcons.mdiEmailOffOutline} /></svg>
            No email required
          </span>
          <span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiIcons.mdiCreditCardOffOutline} /></svg>
            No subscriptions
          </span>
        </div>

        {#if data.user}
          <a href="/" class="hero-cta">
            Open the editor
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiIcons.mdiArrowRight} /></svg>
          </a>
        {:else}
          <a href="/register" class="hero-cta">
            New Project
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiIcons.mdiArrowRight} /></svg>
          </a>
        {/if}
      </div>

      <div class="demo">
        <div class="video-wrapper">
          <video
            autoplay
            muted
            controls
            playsinline
            preload="metadata"
            poster="/vesp-demo-poster.jpg"
            aria-label="Build a Home Assistant display with vESP.cloud"
          >
            <source src="/vesp-demo.mp4" type="video/mp4" />
            Your browser cannot play this video.
            <a href="https://youtu.be/WDWVjb6fvms" target="_blank" rel="noopener">Watch it on YouTube</a>.
          </video>
        </div>
      </div>
    </section>

    <section class="showcase" aria-labelledby="showcase-heading">
      <h2 id="showcase-heading" class="showcase-title">Dashboard screenshots</h2>

      <div class="gallery-tabs" role="group" aria-label="Preview style">
        {#each galleryModes as mode}
          <button
            type="button"
            class:active={galleryMode === mode.value}
            class:timer-phase={galleryTimerPhase}
            aria-pressed={galleryMode === mode.value}
            onclick={() => selectGalleryMode(mode.value)}
          >
            {mode.label}
          </button>
        {/each}
      </div>

      <div class="preview-grid">
        {#each examples as example}
          {@const image = example.images[galleryMode]}
          <figure class="preview-card">
            <div class="preview-image">
              <img src={image.src} alt={image.alt} width="640" height="640" decoding="async" />
            </div>
            <figcaption>
              <span>{example.name}</span>
              <small>{galleryModes[galleryMode].caption}</small>
            </figcaption>
          </figure>
        {/each}
      </div>
    </section>


    <section class="hardware-section">
      <div class="hardware-photo">
        <img src="/display.jpg" alt="Guition ESP32-S3 480 by 480 pixel touch display" loading="lazy" />
      </div>
      <div class="hardware-copy">
        <span class="section-kicker">Simple hardware</span>
        <h2>All you need is one affordable display.</h2>
        <p>
          The Guition ESP32-S3 combines a 480 × 480 touch screen, Wi-Fi, and USB-C in one compact
          device. No hub or custom electronics required.
        </p>
        <div class="hardware-meta">
          <strong>About €20</strong>
          <span>ESP32-S3</span>
          <span>4-inch touch display</span>
        </div>
        <a
          href="https://www.aliexpress.com/wholesale?SearchText=Guition+ESP32-S3+480x480"
          target="_blank"
          rel="noopener"
        >
          Find compatible hardware
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiIcons.mdiOpenInNew} /></svg>
        </a>
      </div>
    </section>

    <section class="free-section">
      <div class="free-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiIcons.mdiGiftOutline} /></svg>
      </div>
      <div>
        <span class="section-kicker">Free means free</span>
        <h2>Firmware Building included</h2>
        <p>
          The editor and complete ESPHome code export are free to use. Optional cloud builds and
          wireless updates are available when you want the extra convenience—never as a
          subscription.
        </p>
      </div>
      <ul>
        <li><svg viewBox="0 0 24 24"><path d={mdiIcons.mdiCheck} /></svg>Free editor</li>
        <li><svg viewBox="0 0 24 24"><path d={mdiIcons.mdiCheck} /></svg>Free code export</li>
        <li><svg viewBox="0 0 24 24"><path d={mdiIcons.mdiCheck} /></svg>No subscription</li>
      </ul>
    </section>

    <section class="bottom-cta">
      <img src={logo1024} alt="" />
      <div>
        <h2>Ready to build your display?</h2>
        <p>Free to start. No email address required.</p>
      </div>
      {#if data.user}
        <a href="/">Open the editor <span>→</span></a>
      {:else}
        <a href="/register">Lets go <span>→</span></a>
      {/if}
    </section>
  </main>

  <footer>
    <span>© {new Date().getFullYear()} vESP.cloud</span>
    <div><a href="https://docs.vesp.cloud">Docs</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
  </footer>
</div>

<style>
  :global(body) {
    background:
      radial-gradient(circle at 82% 7%, rgba(83, 196, 202, 0.1), transparent 26rem),
      radial-gradient(circle at 8% 32%, rgba(241, 36, 112, 0.06), transparent 25rem), #0d0f10;
  }

  .intro-page {
    width: min(1180px, calc(100% - 3rem));
    margin: 0 auto;
    min-height: 100vh;
    color: #f7f9f9;
  }

  nav {
    height: 84px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    color: #fff;
    font-size: 1.05rem;
    font-weight: 750;
    text-decoration: none;
    letter-spacing: -0.02em;
  }

  .brand img {
    width: 38px;
    height: 38px;
    border-radius: 10px;
  }

  .nav-actions {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .nav-actions a {
    color: #aeb8b9;
    font-size: 0.9rem;
    font-weight: 600;
    text-decoration: none;
  }

  .nav-actions a:hover { color: #fff; }

  .nav-actions .nav-primary {
    padding: 0.65rem 1rem;
    border: 1px solid rgba(83, 196, 202, 0.45);
    border-radius: 0.65rem;
    corner-shape: bevel;
    color: #72d8dc;
  }

  main { display: flex; flex-direction: column; gap: 8rem; padding: 4.5rem 0 6rem; }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(500px, 1.1fr);
    align-items: center;
    gap: clamp(3rem, 6vw, 6rem);
  }

  .section-kicker {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    color: #65d0d5;
    font-size: 0.82rem;
    font-weight: 750;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }

  h1 {
    margin: 1.1rem 0 1.4rem;
    font-size: clamp(3.2rem, 5.6vw, 5.4rem);
    line-height: 0.95;
    letter-spacing: -0.06em;
    font-weight: 830;
  }

  h1 span { color: #53c4ca; }

  .hero-lede {
    max-width: 33rem;
    margin: 0;
    color: #aeb8b9;
    font-size: 1.18rem;
    line-height: 1.65;
  }

  .trust-row { display: flex; flex-wrap: wrap; gap: 0.75rem 1.1rem; margin: 1.8rem 0; }
  .trust-row span { display: inline-flex; align-items: center; gap: 0.4rem; color: #d7dddd; font-size: 0.9rem; font-weight: 650; }
  .trust-row svg { width: 17px; height: 17px; fill: #63d891; }

  .hero-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.95rem 1.25rem;
    border-radius: 0.7rem;
    corner-shape: bevel;
    background: #53c4ca;
    color: #071011;
    font-size: 0.95rem;
    font-weight: 800;
    text-decoration: none;
    box-shadow: 0 12px 35px rgba(83, 196, 202, 0.18);
    transition: transform 160ms ease, background 160ms ease;
  }
  .hero-cta svg { width: 18px; height: 18px; fill: currentColor; }
  .demo { position: relative; }
  .demo::before {
    content: '';
    position: absolute;
    inset: -25px;
    z-index: -1;
    border-radius: 2rem;
    background: linear-gradient(135deg, rgba(83, 196, 202, 0.16), rgba(241, 36, 112, 0.08));
    filter: blur(28px);
  }
  .video-wrapper { position: relative; overflow: hidden; aspect-ratio: 16 / 9; padding: 1px; border-radius: 1.4rem; corner-shape: bevel; background: linear-gradient(135deg, rgba(83,196,202,.6), rgba(255,255,255,.08) 45%, rgba(241,36,112,.5)); box-shadow: 0 30px 70px rgba(0,0,0,.45); }
  .video-wrapper::after { content: ''; position: absolute; right: 16px; bottom: 0; z-index: 2; width: 58px; height: 3px; background: #f12470; pointer-events: none; }
  .video-wrapper video { display: block; width: 100%; height: 100%; border: 0; border-radius: calc(1.4rem - 1px); corner-shape: bevel; background: #050606; object-fit: cover; }

  .showcase-title { margin: 0 0 1.5rem; color: #fff; font-size: clamp(1.75rem, 3vw, 2.35rem); line-height: 1.1; letter-spacing: -.035em; text-align: center; }

  .gallery-tabs { display: flex; gap: 0.3rem; width: fit-content; margin: 0 auto 1.5rem; padding: 0.3rem; border: 1px solid rgba(255,255,255,.08); border-radius: .8rem; background: #151819; }
  .gallery-tabs button { position: relative; min-width: 95px; overflow: hidden; padding: 0.65rem 0.8rem 0.72rem; border: 0; border-radius: .55rem; background: transparent; color: #8f999b; font: inherit; font-size: 0.84rem; font-weight: 650; cursor: pointer; }
  .gallery-tabs button.active { background: #273033; color: #70d8dc; }
  .gallery-tabs button.active::after { content: ''; position: absolute; right: 0; bottom: 0; left: 0; height: 2px; background: #53c4ca; transform: scaleX(0); transform-origin: left; animation: gallery-timer-a 6s linear forwards; }
  .gallery-tabs button.timer-phase.active::after { animation-name: gallery-timer-b; }
  .gallery-tabs button:focus-visible, a:focus-visible { outline: 2px solid #70d8dc; outline-offset: 3px; }


  @keyframes gallery-timer-a {
    to { transform: scaleX(1); }
  }

  @keyframes gallery-timer-b {
    to { transform: scaleX(1); }
  }

  .preview-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.25rem; }
  .preview-card { position: relative; margin: 0; overflow: hidden; border: 1px solid rgba(255,255,255,.09); border-radius: 1rem; corner-shape: bevel; background: #151819; box-shadow: 0 20px 45px rgba(0,0,0,.2); }
  .preview-card::after { content: ''; position: absolute; top: 0; right: 18px; width: 38px; height: 2px; background: #53c4ca; }
  .preview-image { aspect-ratio: 1; overflow: hidden; background: #080a0a; }
  .preview-image img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform 250ms ease; }
  .preview-card:hover img { transform: scale(1.018); }
  .preview-card figcaption { display: flex; align-items: center; justify-content: space-between; padding: 0.9rem 1rem; }
  .preview-card figcaption span { color: #e9eded; font-size: 0.9rem; font-weight: 700; }
  .preview-card figcaption small { color: #939d9f; font-size: 0.82rem; }

  .hardware-section { display: grid; grid-template-columns: minmax(320px, .85fr) 1fr; align-items: center; gap: clamp(3rem, 7vw, 7rem); }
  .hardware-photo { position: relative; padding: 2.5rem; border-radius: 1.4rem; corner-shape: bevel; background: linear-gradient(145deg, #1b2021, #121516); }
  .hardware-photo::after { content: ''; position: absolute; inset: 12% 8% -4%; z-index: -1; border-radius: 50%; background: rgba(83,196,202,.16); filter: blur(45px); }
  .hardware-photo img { display: block; width: 100%; aspect-ratio: 1; border-radius: 1rem; corner-shape: bevel; object-fit: cover; }
  .hardware-copy p { max-width: 34rem; color: #8f999b; line-height: 1.75; }
  .hardware-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.65rem; margin: 1.5rem 0; }
  .hardware-meta span, .hardware-meta strong { padding: .45rem .7rem; border: 1px solid rgba(255,255,255,.08); border-radius: .45rem; corner-shape: bevel; color: #aeb7b9; font-size: .86rem; }
  .hardware-meta strong { border-color: rgba(83,196,202,.28); color: #6ed3d8; }
  .hardware-copy > a { display: inline-flex; align-items: center; gap: .45rem; color: #fff; font-size: .88rem; font-weight: 700; text-decoration: none; }
  .hardware-copy > a:hover { color: #6ed3d8; }
  .hardware-copy > a svg { width: 15px; height: 15px; fill: currentColor; }

  .free-section { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 2rem; padding: 2.5rem 3rem; border: 1px solid rgba(99,216,145,.2); border-radius: 1.2rem; corner-shape: bevel; background: linear-gradient(120deg, rgba(99,216,145,.09), rgba(83,196,202,.04)); }
  .free-icon { display: grid; place-items: center; width: 58px; height: 58px; border-radius: 1rem; corner-shape: bevel; background: rgba(99,216,145,.12); }
  .free-icon svg { width: 28px; height: 28px; fill: #63d891; }
  .free-section h2 { font-size: 2rem; }
  .free-section p { max-width: 40rem; margin: .8rem 0 0; color: #aab4b3; font-size: 1rem; line-height: 1.65; }
  .free-section ul { display: flex; flex-direction: column; gap: .65rem; min-width: 155px; margin: 0; padding: 0; list-style: none; }
  .free-section li { display: flex; align-items: center; gap: .5rem; color: #dce5e1; font-size: .92rem; font-weight: 650; }
  .free-section li svg { width: 16px; height: 16px; fill: #63d891; }

  .bottom-cta { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 1.5rem; padding: 2.5rem; border-radius: 1.2rem; corner-shape: bevel; background: #171a1b; }
  .bottom-cta img { width: 64px; height: 64px; border-radius: 14px; }
  .bottom-cta h2 { margin: 0; font-size: 1.6rem; }
  .bottom-cta p { margin: .45rem 0 0; color: #b3bdbf; font-size: 1rem; line-height: 1.5; }
  .bottom-cta > a { display: inline-flex; align-items: center; gap: .8rem; padding: .9rem 1.15rem; border-radius: .65rem; corner-shape: bevel; background: #53c4ca; color: #071011; font-size: .88rem; font-weight: 800; text-decoration: none; }

  footer { display: flex; justify-content: space-between; padding: 1.75rem 0 2.5rem; border-top: 1px solid rgba(255,255,255,.06); color: #7f898b; font-size: .84rem; }
  footer div { display: flex; gap: 1.2rem; }
  footer a { color: #758083; text-decoration: none; }
  footer a:hover { color: #fff; }

  @media (max-width: 900px) {
    main { gap: 6rem; padding-top: 2.5rem; }
    .hero { grid-template-columns: 1fr; gap: 3.5rem; }
    .hero-copy { max-width: 42rem; }
    .demo { width: 100%; }
    .free-section { grid-template-columns: auto 1fr; }
    .free-section ul { grid-column: 2; flex-direction: row; flex-wrap: wrap; }
  }

  @media (max-width: 700px) {
    .intro-page { width: min(100% - 1.5rem, 1180px); }
    nav { height: 70px; }
    .brand span { display: none; }
    .nav-actions { gap: 1rem; }
    .nav-actions > a:first-child { display: none; }
    main { gap: 5rem; padding: 2.5rem 0 4rem; }
    h1 { font-size: clamp(2.8rem, 14vw, 4.2rem); }
    .hero-lede { font-size: 1rem; }
    .trust-row { gap: .65rem 1rem; }
    .gallery-tabs { width: 100%; }
    .gallery-tabs button { flex: 1; min-width: 0; }
    .preview-grid { display: flex; margin-right: -.75rem; padding-right: .75rem; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
    .preview-grid::-webkit-scrollbar { display: none; }
    .preview-card { flex: 0 0 min(82vw, 330px); scroll-snap-align: start; }
    .hardware-section { grid-template-columns: 1fr; gap: 2.5rem; }
    .hardware-photo { padding: 1.5rem; }
    .free-section { grid-template-columns: 1fr; padding: 2rem 1.5rem; }
    .free-section ul { grid-column: auto; flex-direction: column; }
    .bottom-cta { grid-template-columns: auto 1fr; padding: 1.5rem; }
    .bottom-cta img { width: 52px; height: 52px; }
    .bottom-cta > a { grid-column: 1 / -1; justify-content: center; }
    footer { padding-inline: .25rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
    .gallery-tabs button.active::after { transform: scaleX(1); animation: none; }
  }
</style>
