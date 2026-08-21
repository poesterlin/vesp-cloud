---
id: 06-grilling-schema-migration
map: circular-display-support
title: Grilling — Schema migration & versioning plan
type: grilling
status: closed
assignee: ox-alpha (session of 2026-08-21)
blocked-by:
  - 03-grilling-device-profile-architecture
blocks: []
---

## Question

What is the exact migration path that gives every existing project the
Guition device profile without user action?

Locked context: auto-migrate decided; the default device is the Guition
ESP32-S3-4848S040.

Decisions to reach:

- Schema version bump strategy (`version` field exists on Project already)
- Where migration runs (load-time in editor store? server-side on fetch?
  both?) and whether migrated projects persist immediately or lazily
- Backward compatibility rule: can newer schema projects be opened by older
  deployed editors, and do we care?
- Test strategy for migration (fixture projects, snapshot tests)

Consult `grill-with-docs`. Blocked by the device-profile architecture ticket
because the default value and field shape must exist first.

## Resolution

Decided 2026-08-21 in grilling session with Philip.

Grounding: `version` exists in the schema and `LATEST_VERSION = "1.0.0"`
is stamped on new projects (`project.svelte.ts:21`), but it is never
checked — loads are bare `JSON.parse`. Migration machinery is greenfield.

1. **Version policy: bump + light check.** `LATEST_VERSION` → `"1.1.0"`.
   On load: if the project's version is older than latest, run
   `migrate(project)`; if newer than the editor knows, open anyway with a
   warning toast (no strict gate).
2. **Persistence: immediate write-back.** After migrating on load, the
   migrated project is saved back to the server right away (user
   override of lazy-persist option) — stored projects converge to
   current schema after first open.
3. **Migration scope: minimal chain.** One `migrate()` function with
   small idempotent steps; today exactly one step per ticket 03:
   fill `device: "guition-esp32-s3-4848s040"` when absent. Future
   schema fields append steps; no version-ladder framework.

Implementation notes:

- Test strategy (recommendation): fixture project JSONs (pre-1.1 without
  device field) + unit tests asserting migrate() output and idempotency;
  fits the existing `codegen/__tests__` bun-test setup.
- Immediate write-back requires the load path to be able to invoke the
  save path once migration changed something (skip write when nothing
  changed).
- The warning toast for newer versions is fire-and-forget UI; no
  blocking dialog.
