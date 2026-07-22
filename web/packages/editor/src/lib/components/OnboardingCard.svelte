<script lang="ts">
  import { fly, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { onMount } from "svelte";
  import * as mdiIcons from "@mdi/js";
  import { CREDIT_COSTS } from "$lib/credits/costs";

  const buildsAreFree = $derived(CREDIT_COSTS.compile === 0);

  interface Props {
    onDismiss: () => void;
  }

  let { onDismiss }: Props = $props();

  let dismissed = $state(false);
  let isMobile = $state(false);

  onMount(() => {
    isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || 'ontouchstart' in window;
  });

  function handleDismiss() {
    dismissed = true;
    localStorage.setItem("onboarding-dismissed", "1");
    onDismiss();
  }
</script>

{#if !dismissed}
  <section
    class="onboarding-card"
    in:scale={{ start: 0.95, duration: 500, easing: cubicOut }}
    out:fly={{ y: -30, duration: 300 }}
  >
    {#if isMobile}
      <div class="mobile-warning">
        <svg width="20" height="20" viewBox="0 0 24 24" class="icon">
          <path d={mdiIcons.mdiMonitor} />
        </svg>
        <span>vESP.cloud is built for laptop and desktop use. Please switch to a larger screen for the best experience.</span>
      </div>
    {/if}
    <div class="onboarding-header">
      <h2>Welcome to vESP.cloud</h2>
      <p>
        Everything you need to know to get your smart display up and running.
      </p>
    </div>

    <div class="onboarding-body">
      <div class="info-block hardware">
        <div class="info-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" class="icon">
            <path d={mdiIcons.mdiMonitorScreenshot} />
          </svg>
        </div>
        <div class="info-content">
          <h3>What You'll Need</h3>
          <div class="hardware-details">
            <img
              class="hardware-image"
              src="/display.jpg"
              alt="Guition ESP32-S3-4848S040 display"
              loading="lazy"
            />
            <div class="hardware-text">
              <a
                href="https://aliexpress.com/item/1005006622746590.html"
                target="_blank"
                class="link"
              >
                <strong class="hardware-name">Guition ESP32-S3-4848S040</strong>
                <svg width="14" height="14" viewBox="0 0 24 24" class="icon link-icon">
                  <path d={mdiIcons.mdiOpenInNew} />
                </svg>
              </a>
              <span class="hardware-specs">480 &times; 480 pixel display</span>
              <span class="hardware-description">ESP32-S3 with integrated touch display, USB-C, and Wi-Fi connectivity</span>
              <span class="hardware-price">&sim;€25</span>
              <a
                href="https://youtu.be/WDWVjb6fvms"
                target="_blank"
                class="link demo-link"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" class="icon link-icon">
                  <path d={mdiIcons.mdiYoutube} />
                </svg>
                Display demo
                <svg width="12" height="12" viewBox="0 0 24 24" class="icon link-icon">
                  <path d={mdiIcons.mdiOpenInNew} />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="info-block">
        <div class="info-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" class="icon">
            <path d={mdiIcons.mdiInformationOutline} />
          </svg>
        </div>
        <div class="info-content">
          <h3>How It Works</h3>
          <div class="workflow-options">
            <div class="option-local">
              <div class="option-header">
                <svg width="20" height="20" viewBox="0 0 24 24" class="icon">
                  <path d={mdiIcons.mdiDownload} />
                </svg>
                <h4>Self-Hosted ESPHome</h4>
              </div>
              <p>
                Download the generated code and flash it with your own ESPHome
                setup. <strong>Completely free</strong> &mdash; the code is yours
                to keep, modify, and run however you like.
              </p>
            </div>
            <div class="option-cloud">
              <div class="option-header">
                <svg width="20" height="20" viewBox="0 0 24 24" class="icon">
                  <path d={mdiIcons.mdiCloud} />
                </svg>
                <h4>Cloud Builds &amp; OTA Updates</h4>
              </div>
              <p>
                Design your dashboard, click build, and flash wirelessly. <br>
                {#if buildsAreFree}
                  <strong>Free for the first 30 days</strong>
                {:else}
                  <strong>1 credit per build</strong>
                {/if}
                the most convenient way.
                <a href="/credits" class="link"> Get Credits </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="info-block privacy">
        <div class="info-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" class="icon">
            <path d={mdiIcons.mdiShieldCheck} />
          </svg>
        </div>
        <div class="info-content">
          <h3>Your Data Stays Yours</h3>
          <p>
            We do <b>not</b> collect your Wi-Fi authentication details, Home Assistant
            access tokens, or similar connection secrets through this service.
            Wi-Fi setup is handled entirely by the device. Your network credentials never leave your home.
          </p>
        </div>
      </div>

      <div class="info-block hacs">
        <div class="info-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" class="icon">
            <path d={mdiIcons.mdiHomeAssistant} />
          </svg>
        </div>
        <div class="info-content">
          <h3>Recommended: HACS Integration</h3>
          <p>
            A Home Assistant integration that makes looking up entity IDs simple
            and gives the editor real example data to work with. <em
              >Strongly recommended.</em
            >
          </p>
          <ol class="hacs-steps">
            <li>
              <span class="step-badge">1</span> Add
              <code>https://github.com/poesterlin/ha-metadata-exporter</code> to
              HACS as a custom <strong>Integration</strong>
            </li>
            <li>
              <span class="step-badge">2</span> Install
              <strong>HA Metadata Exporter</strong>, restart Home Assistant, and
              add the integration
            </li>
            <li>
              <span class="step-badge">3</span> Use
              <strong>Download metadata</strong> to export a JSON file
            </li>
            <li>
              <span class="step-badge">4</span> Drag the file into the editor below
              to populate entities &amp; devices
            </li>
          </ol>
          <a class="hacs-guide-link" href="/home-assistant-entity-export">
            Full installation and entity export guide
            <svg width="14" height="14" viewBox="0 0 24 24" class="icon">
              <path d={mdiIcons.mdiArrowRight} />
            </svg>
          </a>
        </div>
      </div>
    </div>

    <div class="onboarding-footer">
      <a
        href="https://youtu.be/WDWVjb6fvms"
        target="_blank"
        class="tutorial-link"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" class="icon">
          <path d={mdiIcons.mdiSchool} />
        </svg>
        Setup tutorial
        <svg width="12" height="12" viewBox="0 0 24 24" class="icon link-icon">
          <path d={mdiIcons.mdiOpenInNew} />
        </svg>
      </a>
      <button class="primary large" onclick={handleDismiss}>
        <svg width="18" height="18" viewBox="0 0 24 24" class="icon">
          <path d={mdiIcons.mdiCheck} />
        </svg>
        Got it, let&rsquo;s go
      </button>
    </div>
  </section>
{/if}

<style>
  .onboarding-card {
    background: #161616;
    border: 1px solid rgba(83, 196, 202, 0.2);
    border-radius: 1.25rem;
    padding: 0;
    margin-bottom: 4rem;
    overflow: hidden;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.24);
  }

  .mobile-warning {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2.5rem;
    background: rgba(255, 152, 0, 0.1);
    border-bottom: 1px solid rgba(255, 152, 0, 0.15);
    color: #ff9800;
    font-size: 0.85rem;
    line-height: 1.45;
  }

  .mobile-warning .icon {
    flex-shrink: 0;
    opacity: 0.8;
  }

  .onboarding-header {
    text-align: left;
    padding: 2.75rem 2.5rem 2.25rem;
    background:
      linear-gradient(110deg, rgba(241, 36, 112, 0.07), transparent 35%),
      linear-gradient(290deg, rgba(83, 196, 202, 0.07), transparent 40%);
    border-bottom: 1px solid rgba(83, 196, 202, 0.12);
  }

  .onboarding-header h2 {
    font-size: 1.85rem;
    font-weight: 700;
    color: #fff;
    margin-bottom: 0.5rem;
  }

  .onboarding-header p {
    color: var(--color-text-secondary);
    font-size: 1.05rem;
    line-height: 1.6;
  }

  .onboarding-body {
    padding: 2rem 2.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  .info-block {
    display: flex;
    gap: 1.25rem;
    padding: 1.5rem;
    background: #1a1a1a;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 1rem;
    transition: border-color 0.2s;
  }

  .info-block:hover {
    border-color: rgba(83, 196, 202, 0.2);
  }

  .info-icon {
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

  .info-content {
    flex: 1;
    min-width: 0;
  }

  .info-content h3 {
    font-size: 1.2rem;
    font-weight: 600;
    color: #fff;
    margin-bottom: 0.5rem;
  }

  .info-content p {
    color: var(--color-text-secondary);
    font-size: 1rem;
    line-height: 1.65;
  }

  .icon {
    fill: currentColor;
    stroke: none;
  }

  .hardware-details {
    display: flex;
    gap: 1.5rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .hardware-image {
    width: 140px;
    height: auto;
    border-radius: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .hardware-text {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .hardware-name {
    font-size: 1.05rem;
    color: #fff;
  }

  .hardware-specs {
    color: var(--color-text-secondary);
    font-size: 0.95rem;
  }

  .hardware-price {
    color: #f1b829;
    font-weight: 600;
    font-size: 1.05rem;
  }

  .hardware-description {
    color: #909090;
    font-size: 0.92rem;
    line-height: 1.55;
  }

  .link-icon {
    opacity: 0.5;
    transition: opacity 0.2s, color 0.2s;
    flex-shrink: 0;
  }

  .workflow-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 0.75rem;
  }

  .option-cloud,
  .option-local {
    padding: 1.25rem;
    border-radius: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: #121212;
  }

  .link {
    color: currentColor;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .link:hover .hardware-name {
    color: var(--color-accent);
  }

  .link:hover .link-icon {
    opacity: 1;
    color: var(--color-accent);
  }

  .demo-link {
    font-size: 0.95rem;
    color: var(--color-text-secondary);
  }

  .demo-link:hover {
    color: #ff0000;
  }

  .demo-link:hover .link-icon {
    opacity: 1;
    color: #ff0000;
  }

  .hardware-name {
    font-size: 1.05rem;
    color: #fff;
    transition: color 0.2s;
  }

  .option-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    color: #53c4ca;
  }

  .option-header h4 {
    font-size: 1rem;
    font-weight: 600;
    color: #fff;
  }

  .option-cloud p,
  .option-local p {
    font-size: 0.95rem;
    color: var(--color-text-secondary);
    line-height: 1.6;
  }

  .option-cloud p strong,
  .option-local p strong {
    color: #fff;
  }

  .privacy .info-icon {
    background: rgba(74, 222, 128, 0.1);
    color: #4ade80;
  }

  .privacy {
    border-color: rgba(74, 222, 128, 0.1);
  }

  .privacy:hover {
    border-color: rgba(74, 222, 128, 0.2);
  }

  .hacs-steps {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .hacs-steps li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--color-text-secondary);
  }

  .hacs-steps li strong {
    color: #fff;
  }

  .hacs-guide-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 1rem;
    color: var(--color-accent);
    font-weight: 600;
    text-decoration: none;
  }

  .hacs-guide-link:hover { color: var(--color-accent-hover); }

  .step-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(83, 196, 202, 0.15);
    color: #53c4ca;
    font-size: 0.8rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .onboarding-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 1.5rem 2.5rem 2.5rem;
  }

  .tutorial-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.95rem;
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

  .tutorial-link:hover .link-icon {
    opacity: 1;
    color: #ff0000;
  }

  .onboarding-footer button {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.85rem 2rem;
    font-size: 1rem;
    font-weight: 600;
    border-radius: var(--radius-lg);
    background: #53c4ca;
    color: #071014;
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .onboarding-footer button:hover {
    background: #70d2d7;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(83, 196, 202, 0.22);
  }

  @media (max-width: 640px) {
    .onboarding-header,
    .onboarding-body,
    .onboarding-footer {
      padding-left: 1.25rem;
      padding-right: 1.25rem;
    }

    .hardware-details {
      flex-direction: column;
      align-items: flex-start;
    }

    .hardware-image {
      width: 100%;
      max-width: 200px;
    }

    .workflow-options {
      grid-template-columns: 1fr;
    }
  }
</style>
