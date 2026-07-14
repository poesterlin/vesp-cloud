# Home Assistant Development Environment

Local Home Assistant `dev` container for testing both vESP.cloud custom integrations.

## Setup

```bash
cd dev-homeassistant
docker compose up -d
```

Wait ~30 seconds, then open http://localhost:8123 and complete onboarding.

Both integration domain directories under `integrations/` are bind-mounted into
the container's `/config/custom_components/` directory. Code changes take effect
on restart.

## Commands

```bash
docker compose up -d       # start
docker compose stop         # stop
docker compose restart      # restart (picks up code changes)
docker compose logs -f      # tail logs
docker compose down         # tear down
```

## Testing notification overlay

After setup, three helper entities are auto-created:

| Entity | Purpose |
|--------|---------|
| `input_text.notification_title` | Notification header text |
| `input_text.notification_body` | Notification body text |
| `input_select.notification_severity` | Severity level (`info`, `warning`, `question`, `critical`) |

Send a notification by setting these via any automation or **Developer Tools → Services**:

```
Service: input_text.set_value
  entity_id: input_text.notification_body
  value: "Laundry is done"

Service: input_select.select_option
  entity_id: input_select.notification_severity
  option: warning
```

No custom services needed — the ESP32 display reads these entities reactively.

## Resetting login

If the session expires or you lose the password:

```bash
# Stop, delete auth, restart — onboarding reappears
docker compose stop
docker run --rm -v ./config:/config alpine:latest \
  sh -c 'rm -f /config/.storage/auth /config/.storage/auth_provider.homeassistant /config/.storage/onboarding /config/.storage/http.auth'
docker compose up -d
```

All entity state and integrations are preserved — only login credentials are reset.
