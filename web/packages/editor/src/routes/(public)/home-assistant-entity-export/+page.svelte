<script lang="ts">
  import * as mdiIcons from "@mdi/js";

  const repositoryUrl = "https://github.com/poesterlin/ha-metadata-exporter";
</script>

<svelte:head>
  <title>vESP.cloud — Import</title>
  <meta
    name="description"
    content="Install the HA Metadata Exporter with HACS, download a privacy-safe Home Assistant entity dump, and import it into vESP.cloud."
  />
</svelte:head>

<div class="page-shell">
  <div class="glow"></div>

  <nav aria-label="Breadcrumb">
    <a href="/intro">vESP.cloud</a>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiIcons.mdiChevronRight} /></svg>
    <span>Home Assistant entity export</span>
  </nav>

  <main>
    <header>
      <div class="ha-mark">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiIcons.mdiHomeAssistant} /></svg>
      </div>
      <div>
        <span class="eyebrow">HA Metadata Exporter</span>
        <h1>Bring your Home Assistant entities into the editor</h1>
        <p class="lead">
          Export a small metadata file from Home Assistant, then import it into
          vESP.cloud for searchable entity pickers, friendly names, areas,
          attributes, and realistic preview values.
        </p>
      </div>
    </header>

    <section class="privacy-note">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiIcons.mdiShieldLockOutline} /></svg>
      <div>
        <h2>Your secrets stay private</h2>
        <p>
          The export contains configuration metadata such as entity IDs, names,
          states, attributes, devices, services, and areas. Passwords, access
          tokens, and GPS coordinates are stripped. The JSON file is read in
          your browser and stored locally; it is not uploaded to vESP.cloud.
        </p>
      </div>
    </section>

    <section class="guide" aria-labelledby="setup-heading">
      <div class="section-heading">
        <span>Setup</span>
        <h2 id="setup-heading">Install HACS Integration</h2>
      </div>

      <ol class="steps">
        <li>
          <span class="number">1</span>
          <div>
            <h3>Add the custom repository to HACS</h3>
            <p>
              In Home Assistant, open <strong>HACS</strong>, choose
              <strong>Integrations</strong>, open the menu, and select
              <strong>Custom repositories</strong>.
            </p>
            <div class="repo-row">
              <code>{repositoryUrl}</code>
              <a href={repositoryUrl} target="_blank" rel="noopener noreferrer">
                Open repository
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiIcons.mdiOpenInNew} /></svg>
              </a>
            </div>
            <p class="hint">Paste the URL and select <strong>Integration</strong> as the category.</p>
          </div>
        </li>

        <li>
          <span class="number">2</span>
          <div>
            <h3>Install HA Metadata Exporter</h3>
            <p>
              Find <strong>HA Metadata Exporter</strong> in HACS, install it,
              and restart Home Assistant when prompted.
            </p>
          </div>
        </li>

        <li>
          <span class="number">3</span>
          <div>
            <h3>Add the integration</h3>
            <p>
              Go to <strong>Settings → Devices &amp; services</strong>, choose
              <strong>Add integration</strong>, and select
              <strong>HA Metadata Exporter</strong>. A new exporter page will
              appear in the Home Assistant sidebar.
            </p>
          </div>
        </li>

        <li>
          <span class="number">4</span>
          <div>
            <h3>Download your metadata</h3>
            <p>
              Open the exporter page and click
              <strong>Download metadata</strong>. Home Assistant saves
              <code>ha-metadata.json</code> to your computer.
            </p>
          </div>
        </li>

        <li>
          <span class="number">5</span>
          <div>
            <h3>Import it into vESP.cloud</h3>
            <p>
              Return to the editor and choose <strong>Import JSON Dump</strong>,
              or drop the file into an entity picker. Re-export and import the
              file whenever your Home Assistant entities change.
            </p>
            <a class="primary-action" href="/">
              Open the editor
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiIcons.mdiArrowRight} /></svg>
            </a>
          </div>
        </li>
      </ol>
    </section>

    <section class="details-grid">
      <article>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiIcons.mdiFileDocumentOutline} /></svg>
        <h2>What the dump is for</h2>
        <p>
          It helps the editor discover your entities. Generated firmware still
          connects directly to your Home Assistant instance; the dump is not a
          live connection and does not grant access to your home.
        </p>
      </article>
      <article>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiIcons.mdiRefresh} /></svg>
        <h2>Keep it current</h2>
        <p>
          If you rename, add, or remove entities, download a fresh file and use
          the editor's Update action. Existing project bindings are not changed
          automatically.
        </p>
      </article>
      <article>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={mdiIcons.mdiWrenchOutline} /></svg>
        <h2>If it does not appear</h2>
        <p>
          Confirm Home Assistant was restarted after the HACS install, then add
          the integration from Devices &amp; services. The exporter requires Home
          Assistant 2024.1 or newer.
        </p>
      </article>
    </section>
  </main>
</div>

<style>
  .page-shell { position:relative; max-width:960px; min-height:100vh; margin:0 auto; padding:2rem 2rem 6rem; }
  .page-shell::before { content:""; position:fixed; inset:0; z-index:-2; background-image:linear-gradient(rgba(83,196,202,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(83,196,202,.035) 1px,transparent 1px); background-size:32px 32px; mask-image:linear-gradient(to bottom,#000,transparent 70%); }
  .glow { position:fixed; z-index:-1; top:-15rem; left:50%; width:min(900px,100%); height:520px; transform:translateX(-50%); background:radial-gradient(circle,rgba(65,160,190,.17),transparent 68%); pointer-events:none; }
  nav { display:flex; align-items:center; gap:.4rem; margin-bottom:3.5rem; color:#777; font-size:.85rem; }
  nav a { color:#a8b4bd; text-decoration:none; } nav a:hover { color:#53c4ca; }
  nav svg { width:15px; fill:currentColor; }
  header { display:grid; grid-template-columns:72px 1fr; gap:1.5rem; align-items:start; margin-bottom:2.5rem; }
  .ha-mark { display:grid; place-items:center; width:72px; height:72px; border:1px solid rgba(83,196,202,.3); border-radius:20px; color:#53c4ca; background:rgba(83,196,202,.09); }
  .ha-mark svg { width:42px; fill:currentColor; }
  .eyebrow,.section-heading span { display:block; margin-bottom:.65rem; color:#53c4ca; font-size:.76rem; font-weight:700; letter-spacing:.16em; text-transform:uppercase; }
  h1 { max-width:720px; color:#fff; font-size:clamp(2.3rem,5vw,4rem); line-height:1.02; letter-spacing:-.045em; }
  .lead { max-width:720px; margin-top:1.2rem; color:#aeb6bd; font-size:1.15rem; line-height:1.7; }
  .privacy-note { display:flex; gap:1rem; margin:2.5rem 0 4.5rem; padding:1.4rem 1.5rem; border:1px solid rgba(76,175,80,.25); border-radius:14px; background:rgba(76,175,80,.07); }
  .privacy-note > svg { flex:0 0 auto; width:28px; color:#71d379; fill:currentColor; }
  .privacy-note h2 { margin-bottom:.35rem; font-size:1rem; color:#d9f6dc; }
  .privacy-note p { color:#a8b9aa; line-height:1.6; }
  .guide { overflow:hidden; border:1px solid rgba(255,255,255,.09); border-radius:20px; background:#181818; }
  .section-heading { padding:2rem 2.25rem; border-bottom:1px solid rgba(255,255,255,.07); }
  .section-heading h2 { color:#fff; font-size:1.65rem; }
  .steps > li { display:grid; grid-template-columns:42px 1fr; gap:1.25rem; padding:2rem 2.25rem; border-bottom:1px solid rgba(255,255,255,.06); }
  .steps > li:last-child { border-bottom:0; }
  .number { display:grid; place-items:center; align-self:start; width:38px; height:38px; border-radius:50%; background:rgba(83,196,202,.12); color:#69d3d8; font-weight:700; }
  .steps h3 { margin:.35rem 0 .6rem; color:#f5f5f5; font-size:1.1rem; }
  .steps p { max-width:710px; color:#9d9d9d; line-height:1.65; }
  strong { color:#ddd; } code { padding:.18rem .4rem; border-radius:5px; color:#b8e9eb; background:#292929; font-size:.88em; overflow-wrap:anywhere; }
  .repo-row { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin:1rem 0 .55rem; padding:.75rem .9rem; border:1px solid rgba(255,255,255,.08); border-radius:9px; background:#111; }
  .repo-row code { padding:0; background:none; }
  .repo-row a,.primary-action { display:inline-flex; align-items:center; gap:.35rem; flex:0 0 auto; color:#73d3d8; text-decoration:none; font-weight:600; }
  .repo-row svg,.primary-action svg { width:16px; fill:currentColor; }
  .hint { font-size:.86rem; }
  .primary-action { width:max-content; margin-top:1.2rem; padding:.7rem 1rem; border-radius:8px; color:#101818; background:#53c4ca; }
  .primary-action:hover { background:#73d5da; }
  .details-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin-top:1.25rem; }
  article { padding:1.5rem; border:1px solid rgba(255,255,255,.08); border-radius:14px; background:#181818; }
  article > svg { width:24px; margin-bottom:1.1rem; color:#53c4ca; fill:currentColor; }
  article h2 { margin-bottom:.6rem; color:#eee; font-size:1rem; }
  article p { color:#909090; font-size:.9rem; line-height:1.6; }
  @media (max-width:700px) { .page-shell{padding:1.4rem 1rem 4rem} nav{margin-bottom:2.5rem} header{grid-template-columns:1fr}.ha-mark{width:58px;height:58px;border-radius:16px}.ha-mark svg{width:34px}.privacy-note{margin-bottom:3rem}.section-heading,.steps>li{padding:1.5rem}.steps>li{grid-template-columns:34px 1fr;gap:.9rem}.number{width:32px;height:32px}.repo-row{align-items:flex-start;flex-direction:column}.details-grid{grid-template-columns:1fr} }
</style>
