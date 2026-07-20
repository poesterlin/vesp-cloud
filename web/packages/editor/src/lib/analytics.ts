import { browser } from "$app/environment";

export type AnalyticsEvent =
  | "auth_login_submitted"
  | "auth_registration_submitted"
  | "build_completed"
  | "build_failed"
  | "build_started"
  | "checkout_completed"
  | "checkout_started"
  | "component_added"
  | "device_install_started"
  | "feedback_submitted"
  | "ha_metadata_imported"
  | "project_created"
  | "project_files_downloaded";

export type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: AnalyticsData) => void;
    };
  }
}

/**
 * Track product behavior without ever blocking the user's action. Callers must
 * only pass low-cardinality product metadata, never names, IDs, URLs, entity
 * IDs, free text, or other user-provided values.
 */
export function track(event: AnalyticsEvent, data?: AnalyticsData): void {
  if (!browser) return;

  try {
    window.umami?.track(event, data);
  } catch (error) {
    // Analytics must never make the editor or deployment flow fail.
    console.debug("Analytics event was not sent", event, error);
  }
}

