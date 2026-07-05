import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit@3.1.2/index.js?module";

class DisplayMetadataPanel extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      narrow: { type: Boolean },
      panel: { type: Object },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        padding: 16px;
        background-color: var(--primary-background-color);
        color: var(--primary-text-color);
        height: 100%;
        overflow-y: auto;
      }

      .container {
        max-width: 800px;
        margin: 0 auto;
      }

      .card {
        background: var(--card-background-color);
        border-radius: var(--ha-card-border-radius, 8px);
        box-shadow: var(--ha-card-box-shadow, 0 2px 2px 0 rgba(0,0,0,0.14), 0 1px 5px 0 rgba(0,0,0,0.12), 0 3px 1px -2px rgba(0,0,0,0.2));
        padding: 16px;
        margin-bottom: 16px;
      }

      h1 {
        margin: 0 0 24px;
        font-size: 24px;
        font-weight: 400;
      }

      h3 {
        margin: 0 0 16px;
      }

      .button {
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
        margin: 8px 8px 8px 0;
        transition: opacity 0.2s;
      }

      .button:hover {
        opacity: 0.8;
      }

      .button.secondary {
        background: var(--secondary-text-color, #727272);
      }

      .status {
        margin: 16px 0;
        padding: 12px;
        border-radius: 4px;
      }

      .status.success {
        background: var(--success-color, #4caf50);
        color: white;
      }

      .status.error {
        background: var(--error-color, #f44336);
        color: white;
      }

      .status.info {
        background: var(--info-color, #2196f3);
        color: white;
      }

      .hidden {
        display: none;
      }

      pre {
        background: var(--secondary-background-color, #eeeeee);
        padding: 12px;
        border-radius: 4px;
        overflow-x: auto;
        font-size: 12px;
        white-space: pre-wrap;
        color: var(--primary-text-color);
        max-height: 400px;
        overflow-y: auto;
      }

      ol {
        padding-left: 20px;
      }

      li {
        margin-bottom: 8px;
      }

      code {
        background: var(--secondary-background-color, #eeeeee);
        padding: 2px 4px;
        border-radius: 3px;
      }

      .privacy-note {
        background: var(--info-background-color, rgba(33, 150, 243, 0.1));
        border-left: 4px solid var(--info-color, #2196f3);
        padding: 12px 16px;
        margin: 16px 0;
        font-size: 14px;
        line-height: 1.5;
      }

      .privacy-note ul {
        margin: 8px 0 0 0;
        padding-left: 20px;
      }
    `;
  }

  render() {
    return html`
      <div class="container">
        <h1>Sync Metadata</h1>

        <div class="card">
          <p>Download your Home Assistant configuration metadata to enable autocomplete and validation in the <strong>Display Web Editor</strong>.</p>

          <div class="privacy-note">
            <strong>🔒 Privacy & Security</strong>
            <ul>
              <li>This export contains entity IDs, service names, and device areas.</li>
              <li>Sensitive data (passwords, tokens, GPS coordinates) is <strong>automatically stripped</strong>.</li>
              <li>The export is performed over a secure, authenticated connection.</li>
              <li>Data is processed locally in your browser and is not stored on any external servers.</li>
            </ul>
          </div>

          <button class="button" @click=${this._exportViaWebSocket}>
            Download Metadata File
          </button>
        </div>

        <div id="status" class="status hidden"></div>

        <div id="preview" class="card hidden">
          <h3>Data Preview:</h3>
          <pre id="preview-content"></pre>
        </div>

        <div class="card">
          <h3>Next Steps</h3>
          <ol>
            <li>Save the <code>display-metadata.json</code> file.</li>
            <li>Open the <strong>Web Editor</strong>.</li>
            <li>Upload the file when prompted to sync your entities.</li>
          </ol>
        </div>
      </div>
    `;
  }

  _showStatus(message, type = 'info') {
    const statusEl = this.shadowRoot.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.classList.remove('hidden');

    if (type === 'success') {
      setTimeout(() => {
        statusEl.classList.add('hidden');
      }, 5000);
    }
  }

  _showPreview(data) {
    const previewEl = this.shadowRoot.getElementById('preview');
    const previewContent = this.shadowRoot.getElementById('preview-content');
    if (previewContent) {
      previewContent.textContent = JSON.stringify(data, null, 2);
    }
    if (previewEl) {
      previewEl.classList.remove('hidden');
    }
  }

  _downloadFile(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async _exportViaWebSocket() {
    if (!this.hass) {
      this._showStatus('Error: No Home Assistant connection available.', 'error');
      return;
    }

    this._showStatus('Exporting metadata via WebSocket...', 'info');

    try {
      const result = await this.hass.callWS({
        type: 'esphome_display/export'
      });

      if (result) {
        this._showStatus('Successfully exported metadata!', 'success');
        this._showPreview(result);
        this._downloadFile(result, 'display-metadata.json');
      } else {
        throw new Error('No data received from WebSocket');
      }
    } catch (error) {
      this._showStatus(`WebSocket export failed: ${error.message}.`, 'error');
    }
  }
}
customElements.define("display-metadata-panel", DisplayMetadataPanel);
