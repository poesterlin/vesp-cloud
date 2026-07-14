import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit@3.1.2/index.js?module";

class HomeAssistantMetadataPanel extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      narrow: { type: Boolean },
      panel: { type: Object },
      metadata: { type: Object, state: true },
      loading: { type: Boolean, state: true },
      error: { type: String, state: true },
    };
  }

  constructor() {
    super();
    this.metadata = null;
    this.loading = true;
    this.error = "";
  }

  static get styles() {
    return css`
      :host {
        display: block;
        min-height: 100%;
        box-sizing: border-box;
        padding: clamp(16px, 3vw, 40px);
        overflow-y: auto;
        color: var(--primary-text-color);
        background:
          radial-gradient(circle at top left, color-mix(in srgb, var(--primary-color) 10%, transparent), transparent 34rem),
          var(--primary-background-color);
      }

      * {
        box-sizing: border-box;
      }

      .container {
        width: min(100%, 1100px);
        margin: 0 auto;
      }

      .card {
        overflow: hidden;
        border: 1px solid var(--divider-color);
        border-radius: 20px;
        background: var(--card-background-color);
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.08);
      }

      .hero {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        padding: clamp(24px, 4vw, 38px);
        border-bottom: 1px solid var(--divider-color);
      }

      .eyebrow {
        margin: 0 0 10px;
        color: var(--primary-color);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0;
        font-size: clamp(28px, 4vw, 38px);
        line-height: 1.1;
        letter-spacing: -0.025em;
      }

      .subtitle {
        max-width: 620px;
        margin: 12px 0 0;
        color: var(--secondary-text-color);
        font-size: 16px;
        line-height: 1.55;
      }

      .status-pill {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 42px;
        padding: 0 16px;
        border: 1px solid color-mix(in srgb, var(--success-color, #43a047) 70%, transparent);
        border-radius: 999px;
        color: var(--success-color, #43a047);
        font-size: 14px;
        font-weight: 600;
        background: color-mix(in srgb, var(--success-color, #43a047) 8%, transparent);
      }

      .status-pill.loading {
        border-color: color-mix(in srgb, var(--primary-color) 60%, transparent);
        color: var(--primary-color);
        background: color-mix(in srgb, var(--primary-color) 8%, transparent);
      }

      .status-pill.error {
        border-color: color-mix(in srgb, var(--error-color, #db4437) 65%, transparent);
        color: var(--error-color, #db4437);
        background: color-mix(in srgb, var(--error-color, #db4437) 8%, transparent);
      }

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: currentColor;
      }

      .content {
        padding: clamp(24px, 4vw, 38px);
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        margin: 0 0 24px;
      }

      .stat {
        min-width: 0;
        padding: 4px 26px;
        border-left: 1px solid var(--divider-color);
      }

      .stat:first-child {
        padding-left: 0;
        border-left: 0;
      }

      .stat-value {
        display: block;
        min-height: 38px;
        font-size: 30px;
        font-weight: 700;
        line-height: 1.2;
        letter-spacing: -0.02em;
      }

      .stat-label {
        display: block;
        margin-top: 8px;
        color: var(--secondary-text-color);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .updated {
        margin: 0 0 28px;
        color: var(--secondary-text-color);
        font-size: 14px;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        min-height: 44px;
        padding: 0 18px;
        border: 1px solid var(--divider-color);
        border-radius: 11px;
        color: var(--primary-text-color);
        background: transparent;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
      }

      button.primary {
        border-color: var(--primary-color);
        color: var(--text-primary-color, #fff);
        background: var(--primary-color);
      }

      button:hover:not(:disabled) {
        transform: translateY(-1px);
        border-color: var(--primary-color);
        background: color-mix(in srgb, var(--primary-color) 8%, transparent);
      }

      button.primary:hover:not(:disabled) {
        background: color-mix(in srgb, var(--primary-color) 88%, #000);
      }

      button:disabled {
        cursor: wait;
        opacity: 0.55;
      }

      .notice {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        margin-top: 30px;
        padding: 16px 18px;
        border-radius: 12px;
        color: var(--secondary-text-color);
        background: var(--secondary-background-color);
        font-size: 14px;
        line-height: 1.5;
      }

      .notice strong {
        display: block;
        margin-bottom: 2px;
        color: var(--primary-text-color);
      }

      @media (max-width: 720px) {
        .hero {
          align-items: flex-start;
          flex-direction: column;
        }

        .stats {
          grid-template-columns: repeat(2, 1fr);
          gap: 24px 0;
        }

        .stat:nth-child(3) {
          padding-left: 0;
          border-left: 0;
        }
      }

      @media (max-width: 430px) {
        :host {
          padding: 12px;
        }

        .card {
          border-radius: 15px;
        }

        .stats {
          grid-template-columns: 1fr;
        }

        .stat,
        .stat:nth-child(3) {
          padding: 16px 0 0;
          border-top: 1px solid var(--divider-color);
          border-left: 0;
        }

        .stat:first-child {
          padding-top: 0;
          border-top: 0;
        }

        button {
          width: 100%;
        }
      }
    `;
  }

  firstUpdated() {
    this._refreshMetadata();
  }

  render() {
    const summary = this._summary();
    return html`
      <main class="container">
        <section class="card">
          <header class="hero">
            <div>
              <p class="eyebrow">Data source</p>
              <h1>Home Assistant</h1>
              <p class="subtitle">
                A simple overview of the devices, entities, and areas available in your home.
              </p>
            </div>
            <div class="status-pill ${this.loading ? "loading" : this.error ? "error" : ""}">
              <span class="dot"></span>
              ${this.loading ? "Loading summary" : this.error ? "Needs attention" : "Metadata ready"}
            </div>
          </header>

          <div class="content">
            <div class="stats" aria-label="Home Assistant summary">
              ${this._stat(summary.entities, "Entities")}
              ${this._stat(summary.devices, "Devices")}
              ${this._stat(summary.domains, "Categories")}
              ${this._stat(summary.areas, "Areas")}
            </div>

            <p class="updated">
              ${this.error
                ? this.error
                : summary.updated
                  ? `Last updated ${summary.updated}`
                  : "Preparing your Home Assistant summary…"}
            </p>

            <div class="actions">
              <button @click=${this._refreshMetadata} ?disabled=${this.loading}>
                <ha-icon icon="mdi:refresh"></ha-icon>
                Refresh
              </button>
              <button class="primary" @click=${this._downloadMetadata} ?disabled=${!this.metadata || this.loading}>
                <ha-icon icon="mdi:download"></ha-icon>
                Download metadata
              </button>
            </div>

            <div class="notice">
              <ha-icon icon="mdi:shield-check-outline"></ha-icon>
              <div>
                <strong>Your private information stays protected</strong>
                Passwords, access tokens, location coordinates, and other sensitive details are
                automatically left out of the downloaded file.
              </div>
            </div>
          </div>
        </section>
      </main>
    `;
  }

  _stat(value, label) {
    return html`
      <div class="stat">
        <span class="stat-value">${this.loading ? "—" : value.toLocaleString()}</span>
        <span class="stat-label">${label}</span>
      </div>
    `;
  }

  _summary() {
    const entities = this.metadata?.entities ?? [];
    const domains = new Set(entities.map((entity) => entity.domain).filter(Boolean));
    const generatedAt = this.metadata?.generated_at;

    return {
      entities: entities.length,
      devices: this.metadata?.devices?.length ?? 0,
      domains: domains.size,
      areas: this.metadata?.areas?.length ?? 0,
      updated: generatedAt
        ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(generatedAt))
        : "",
    };
  }

  async _refreshMetadata() {
    if (!this.hass) {
      this.loading = false;
      this.error = "Home Assistant is not available right now. Please try again.";
      return;
    }

    this.loading = true;
    this.error = "";

    try {
      this.metadata = await this.hass.callWS({ type: "esphome_display/export" });
      if (!this.metadata) {
        throw new Error("No metadata received");
      }
    } catch (error) {
      this.error = "We couldn't load your Home Assistant summary. Please try again.";
      console.error("Metadata refresh failed", error);
    } finally {
      this.loading = false;
    }
  }

  _downloadMetadata() {
    if (!this.metadata) return;

    const blob = new Blob([JSON.stringify(this.metadata, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ha-metadata.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}

customElements.define("ha-metadata-exporter-panel", HomeAssistantMetadataPanel);
