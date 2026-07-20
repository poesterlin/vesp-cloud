# Umami analytics

Analytics is disabled unless both `PUBLIC_ANALYTICS_SCRIPT_URL` and
`PUBLIC_ANALYTICS_WEBSITE_ID` are configured. Set `PUBLIC_ANALYTICS_DOMAINS` to
the comma-separated production hostnames so development and staging sessions do
not pollute launch data. Search parameters and URL hashes are excluded.

Only anonymous, low-cardinality product metadata is recorded. Do not add
project names, project or user IDs, Home Assistant entity IDs, URLs, file names,
feedback text, or other user-provided values to events.

## Events

| Event | Meaning | Properties |
| --- | --- | --- |
| `auth_registration_submitted` | Registration form submitted | — |
| `auth_login_submitted` | Login form submitted | — |
| `project_created` | Project successfully created | notification overlay and timezone configured flags |
| `ha_metadata_imported` | HA metadata import attempted | outcome |
| `component_added` | Component dropped onto the canvas | component type, dashboard/detail surface |
| `build_started` | Firmware build submitted | flow |
| `build_completed` | Firmware build completed | flow, duration in seconds |
| `build_failed` | Firmware build failed | stage |
| `project_files_downloaded` | Local ESPHome project ZIP generated | dashboard/detail counts |
| `device_install_started` | Web installer flow opened | Web Serial support |
| `checkout_started` | Stripe checkout requested | price-pack key |
| `checkout_completed` | User returned from successful checkout | outcome |
| `feedback_submitted` | Feedback successfully saved | — |

## Recommended launch insights

Create funnels for registration → project creation → component addition → build
start → build completion → device install. Track conversion from build failure to
a later successful build, component adoption by `component_type`, build failure
stage, and checkout start → checkout completion. Use Umami's normal pageviews for
landing-page and documentation acquisition; the tracker handles SvelteKit SPA
navigation automatically.
