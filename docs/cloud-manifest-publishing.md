# Cloud manifest publishing

## Workflow

1. Build and install manifest-enabled firmware, or install the registered source ZIP with ESPHome.
2. Edit the project and select **Publish layout** on Deploy. This creates an immutable revision without a compilation job or compile credits.
3. Restart the device. It fetches and validates the latest compatible manifest once, selects download → cache → embedded fallback, and reports the loaded fingerprint.
4. Deploy shows draft, published revision and last device-reported active revision separately. A download or publication does not confirm activation.

Hosted builds and ZIP exports automatically receive project-token download/report URLs and a registered firmware identity. Restart remains manual. Reconnection never replaces the running UI.

The supported subset is text, rectangles, buttons, icons, bindings/conditions and basic navigation. Unsupported features use generated firmware. Theme/chrome-accent changes and new font/icon glyphs require firmware resources. Compatibility is checked against reported installed builds; without reports, installation remains explicitly unconfirmed. New builds include required literal text glyphs in runtime font sizes.

## Application rollout

Apply the additive migration before starting the updated editor and worker:

```sh
# From web/, with the target DATABASE_URL
bun run db:migrate:ui
```

SQL: `web/packages/editor/migrations/20261004-ui-manifests.sql`. For the existing Docker configuration:

```sh
docker compose build vesp-cloud
docker compose run --rm --no-deps vesp-cloud bun run packages/editor/scripts/migrate-ui-manifests.ts
docker compose up -d --wait
```

Update separate compilation workers to the same code. `PUBLIC_BASE_URL` must be device-reachable; compose already assigns the public HTTPS origin. Existing devices need a one-time firmware installation.

## Storage and API

- `ui_firmware_build` records embedded bytes and immutable resource capabilities; metadata survives build-history deletion.
- `ui_manifest_release` stores immutable monotonically numbered project revisions.
- `ui_device_boot` stores each device's latest firmware identity, fingerprint, source, fallback reason and report time.

Firmware and layout publication share a project-row transaction lock. Identical publication reuses the revision. Publishing runtime firmware also publishes its embedded baseline.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/projects/:id/ui-manifest` | Owner deployment status |
| `POST /api/projects/:id/ui-manifest` | Publish saved draft |
| `POST /api/projects/:id/firmware-export` | Registered source ZIP |
| `DELETE /api/projects/:id/ui-devices/:deviceId` | Owner removal of retired devices from publication checks |
| `GET /api/firmware/:token/ui-manifest?build=:id` | Compatible binary manifest |
| `POST /api/firmware/:token/ui-status` | Bounded boot report |

Delivery validates the requesting firmware's resources. Incompatible devices receive HTTP 409 and retain cache/embedded fallback. Unknown token/build combinations are rejected. Device responses, including errors, are not cacheable. Owner routes require authentication and retain CSRF protection.

Cache scope and validated bytes share one atomic NVS blob, replacing a single entry rather than accumulating namespaces per build. Identical writes are suppressed. Invalid/wrong-scope caches fall back to embedded bytes; failed persistence does not prevent valid downloaded bytes rendering that boot.

Job-based source downloads receive a separate available source-export identity,
including pending and failed jobs. Local installation does not require a successful
cloud compilation. Remove retired devices on Deploy to exclude their resources
from future publication checks; another boot report will enroll them again.

Boot reports identify the selected bytes using matching portable FNV-1a fingerprints; releases also store SHA-256. Fingerprints identify revisions, not signatures. Last boot reports are not live connectivity indicators. Offline/failed reporting leaves activation unconfirmed or at its previously reported value.

## Verification

Codegen/host tests cover capabilities, font glyph inclusion, fingerprints, boot selection and cache behavior. Real ESP32-S3 compilation covers HTTPS, NVS, reporting and HTTP OTA. Isolated PostgreSQL/API tests cover transactional publication, ownership, incompatible devices, reporting, bounds and metadata retention. Production HTTP tests cover ZIP contents, delivery, publication without compilation, SSR and CSRF. Browser checks cover desktop/mobile publishing and activation. Both-theme regression checks all 38 widget baselines and eight parity captures.

```sh
# From web/packages/editor; use an isolated database/server
UI_MANIFEST_TEST_DATABASE_URL=postgresql://... bun test src/lib/server/__tests__/ui-manifests.integration.test.ts
UI_MANIFEST_TEST_DATABASE_URL=postgresql://... UI_MANIFEST_HTTP_TEST_URL=http://127.0.0.1:5199 bun test src/lib/server/__tests__/ui-cloud-http.integration.test.ts
```

Physical HTTPS, NVS capacity/persistence, flash/display interaction and HA/hardware behavior still require device validation. Full widget migration, signed releases and A/B rollback remain separate work.
