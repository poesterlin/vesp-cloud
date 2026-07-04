import { projectStore } from "../stores/project.svelte";
import type { Theme } from "@vesp-cloud/schema";

/**
 * Returns the current theme from the project store.
 * Safe to call from anywhere as it doesn't use Svelte lifecycle-locked Context API.
 */
export function getThemeContext(): Theme {
  return projectStore.theme;
}
