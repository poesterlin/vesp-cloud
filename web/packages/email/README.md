# @vesp-cloud/email

Retro-futuristic Svelte email templates for the monorepo.

## Setup

The package depends on:

- `@better-svelte-email/server`
- `@better-svelte-email/components`
- `svelte`

## Exports

Available exports:

- `@vesp-cloud/email`
- `@vesp-cloud/email/address-validation.svelte`
- `@vesp-cloud/email/account-recovery.svelte`

The root export also re-exports:

- `AddressValidationEmail`
- `AccountRecoveryEmail`
- `Renderer`
- `toPlainText`

## Usage

### Render an email

```ts
import { Renderer } from '@vesp-cloud/email';
import AddressValidationEmail from '@vesp-cloud/email/address-validation.svelte';

const { render } = new Renderer();

const html = await render(AddressValidationEmail, {
  props: {
    appName: 'vESP.cloud',
    recipient: 'Alex',
    verificationUrl: 'https://example.com/verify?token=abc'
  }
});
```

### Plain text version

```ts
import { toPlainText } from '@vesp-cloud/email';

const text = toPlainText(html);
```

## Templates

### Address validation

Props:

- `verificationUrl` required
- `appName` optional, defaults to `vESP.cloud`
- `recipient` optional, defaults to `operator`
- `expiresIn` optional, defaults to `10 minutes`

### Account recovery

Props:

- `recoveryUrl` required
- `appName` optional, defaults to `vESP.cloud`
- `recipient` optional, defaults to `operator`
- `expiresIn` optional, defaults to `15 minutes`

## Styling direction

The templates are deliberately retro-futuristic:

- deep space background with neon cyan and magenta accents
- mono-forward headings for a console/terminal feel
- rounded glass panels with hard borders and glowing shadows
- compact, high-contrast CTAs for email-client reliability
- restrained layout so the message reads well in dark-mode email clients

The shared shell lives in `src/email-shell.svelte` and keeps the visual system consistent across templates.

## Development

Type-check the package:

```bash
bun run --filter @vesp-cloud/email lint
```

## Notes

- The package is source-first and exports `.svelte` entrypoints directly.
- Use `Renderer` from `@better-svelte-email/server` to convert templates to HTML.
- Keep email content short and links explicit so it works across clients.
