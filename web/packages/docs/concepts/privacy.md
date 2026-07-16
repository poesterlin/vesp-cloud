# Privacy & Data Handling

VESP Cloud is designed to keep your sensitive data in your control. This page
explains what information is stored where and how it is used.

## What we do not collect

- **Wi-Fi passwords** — Your home network credentials are entered directly
  between your browser and the display during captive portal setup. They are
  never sent to or stored by VESP Cloud.
- **Home Assistant access tokens** — The editor never asks for or stores your
  Home Assistant long-lived access tokens. The generated firmware connects
  directly from the display to Home Assistant on your local network.
- **GPS coordinates** — Home Assistant entity dumps strip location data before
  export.

## What stays in your browser

### Home Assistant entity metadata

The `ha-metadata.json` file you export from Home Assistant is:

- Read and parsed entirely in your browser
- Stored in your browser's localStorage (`vesp-cloud-homeassistant-dump`)
- Never uploaded to VESP Cloud servers

This metadata contains entity IDs, friendly names, states, attributes, device
names, areas, and available services. It helps the editor provide search,
autocomplete, and preview values, but it stays local to your device.

You can clear the metadata at any time from the entity picker.

## What is stored on VESP Cloud servers

### Account information

- Email address (optional, for password recovery)
- Username
- Hashed password (Argon2id, never stored in plain text)

### Project data

- Project name, configuration, and all widget placements and settings
- Display theme, timezone, and notification overlay configuration
- Home Assistant entity IDs referenced by your widgets (but not entity state
  or history)

### Billing records

- Credit balance and transaction history
- Stripe customer ID (for payment processing)

### Compilation logs

- Build output and error logs for troubleshooting

## Data deletion

You can delete your account at any time from the [Account page](https://app.vesp.cloud/account).
This permanently removes your user record, all projects, credit history, and
associated Stripe records in a single transaction. Deletion is irreversible.

## Payment processing

Payments are processed by [Stripe](https://stripe.com). VESP Cloud never sees or
stores your credit card details. Stripe's privacy policy applies to payment
processing.

## Open source

The VESP Cloud codebase is open source. You can review how data is handled in the
[GitHub repository](https://github.com/poesterlin/vesp-cloud).
