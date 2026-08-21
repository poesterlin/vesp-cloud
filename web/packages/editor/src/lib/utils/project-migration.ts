import type { Project } from "@vesp-cloud/schema";
import { DEFAULT_DEVICE_ID } from "$lib/codegen/device-profiles";

/**
 * Schema versioning (wayfinder ticket 06).
 *
 * LATEST_PROJECT_VERSION bumps whenever migrateProjectSchema() learns a
 * new step. Versions listed in KNOWN_VERSIONS are accepted inputs to the
 * migration chain; anything else (newer or unrecognized) is opened as-is
 * with a UI warning and left untouched -- never silently downgraded.
 */
export const LATEST_PROJECT_VERSION = "1.1.0";

const KNOWN_VERSIONS = ["1.0.0", "1.0.1"];

export type MigrationResult = {
  changed: boolean;
  /** True when the project's version was newer/unknown to this editor. */
  fromFuture: boolean;
};

/**
 * In-place, idempotent schema migration. Runs on every project load.
 *
 * Steps (one per schema bump, oldest last):
 *  - <1.1.0: fill `device` with the default profile id (projects predating
 *    device profiles all targeted the Guition board).
 */
export function migrateProjectSchema(project: Project): MigrationResult {
  const result: MigrationResult = { changed: false, fromFuture: false };

  if (!KNOWN_VERSIONS.includes(project.version ?? "1.0.0") && project.version !== LATEST_PROJECT_VERSION) {
    // Unknown (likely newer) schema -- open read-as-is, don't touch.
    result.fromFuture = true;
    return result;
  }

  if (!project.device) {
    project.device = DEFAULT_DEVICE_ID;
    result.changed = true;
  }

  if (project.version !== LATEST_PROJECT_VERSION) {
    project.version = LATEST_PROJECT_VERSION;
    result.changed = true;
  }

  return result;
}
