# Admin Authentication with tsidp

## Packages

```
bun install jose
```

`jose` handles JWT verification against the IDP's JWKS endpoint. The rest — cookies, redirects, route guards — uses SvelteKit's built-in APIs.

## Setup

### 1. SvelteKit app

```bash
npm create svelte@latest my-app
cd my-app
npm install
```

The adapter doesn't matter for this code.

### 2. tsidp

Create an auth key in the [Tailscale admin console](https://login.tailscale.com/admin/settings/keys). Tag it (e.g. `tag:tsidp`) and ensure your ACL's `tagOwners` includes that tag.

Save the `compose.yaml` from above, then:

```bash
docker compose up -d
```

Wait for TLS, then open `https://idp.your-tailnet.ts.net`.

### 3. ACL grant

Paste the grant policy into the [ACL editor](https://login.tailscale.com/admin/acls/). Grants take effect immediately.

### 4. OIDC client

In the tsidp admin UI, register a client with the redirect URIs above. Copy the client secret.

### 5. Environment variables

```bash
cp .env.example .env
```

Add the four variables from the section above.

### 6. Install jose

```bash
npm install jose
```

### 7. Create the auth files

Copy the code from the sections below into your project. The file paths are listed at the start of each section.

### 8. Redirect URI

The redirect URI in tsidp's client config must match exactly what the code uses. `http://localhost:5173/auth/callback/tailscale` — no trailing slash, correct path.

### 9. Run

```bash
npm run dev
```

Open `http://localhost:5173/login`. You land on tsidp, authenticate via Tailscale, and get redirected back. Protected routes are now accessible.

## Core OIDC Client (`src/lib/auth.ts`)

Three functions. Module-level state is just the JWKS client.

```ts
import { env } from "$env/dynamic/private"
import { jwtVerify, createRemoteJWKSet } from "jose"
import crypto from "crypto"
import { dev } from "$app/environment"

const jwks = createRemoteJWKSet(
    new URL(`${env.TSIDP_ISSUER}/.well-known/jwks.json`)
)

export async function getTailscaleIdToken(code: string) {
    const host = dev ? `http://localhost:5173` : env.URL

    const response = await fetch(`${env.TSIDP_ISSUER}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            client_id: env.TSIDP_CLIENT_ID,
            client_secret: env.TSIDP_CLIENT_SECRET,
            redirect_uri: `${host}/auth/callback/tailscale`
        })
    })

    if (!response.ok) throw new Error("Token exchange failed")

    const { id_token } = await response.json()
    const verified = await jwtVerify(id_token, jwks)
    return verified.payload
}

export function generateState(): string {
    return crypto.randomBytes(32).toString("hex")
}

export function getTailscaleAuthUrl(state: string): string {
    const host = dev ? `http://localhost:5173` : env.URL

    const params = new URLSearchParams({
        client_id: env.TSIDP_CLIENT_ID,
        response_type: "code",
        scope: "openid profile email",
        redirect_uri: `${host}/auth/callback/tailscale`,
        state
    })
    return `${env.TSIDP_ISSUER}/authorize?${params}`
}
```

`createRemoteJWKSet` fetches and caches keys from the IDP's JWKS endpoint. Instantiate it once at module scope. `jwtVerify` checks signature, issuer, audience, and expiry.

The `state` parameter is a 32-byte random hex string for CSRF protection.

## Types (`src/app.d.ts`)

```ts
declare global {
    namespace App {
        interface Locals {
            user?: {
                sub: string
                email?: string
                name?: string
            }
        }
    }
}

export {}
```

`Locals.user` holds the authenticated user for the current request. It's set by the hook and available in every `load` function and server route.

## Server Hook (`src/hooks.server.ts`)

Every request passes through this hook. It reads the session cookie and populates `event.locals.user`.

```ts
import { sequence } from "@sveltejs/kit/hooks"
import type { Handle } from "@sveltejs/kit"

const authHandle: Handle = async ({ event, resolve }) => {
    const sessionCookie = event.cookies.get("session")

    if (sessionCookie) {
        try {
            event.locals.user = JSON.parse(sessionCookie)
        } catch {
            event.cookies.delete("session", { path: "/" })
        }
    }

    return resolve(event)
}

export const handle = sequence(authHandle)
```

Corrupt cookies are deleted rather than passed through.

## Login Route (`src/routes/login/+page.server.ts`)

```ts
import { generateState, getTailscaleAuthUrl } from "$lib/auth"
import { redirect } from "@sveltejs/kit"
import type { PageServerLoad } from "./$types"

export const load: PageServerLoad = async ({ cookies, locals }) => {
    if (locals.user) redirect(302, "/")

    const state = generateState()
    cookies.set("oauth_state", state, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 10 * 60
    })

    return { authUrl: getTailscaleAuthUrl(state) }
}
```

The page component renders `data.authUrl` as a link. Clicking it sends the user to tsidp's `/authorize` endpoint.

## OAuth Callback (`src/routes/auth/callback/tailscale/+server.ts`)

The `redirect_uri` registered with tsidp. Validates state, exchanges the code for an ID token, and sets the session cookie.

```ts
import { redirect } from "@sveltejs/kit"
import { getTailscaleIdToken } from "$lib/auth"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ url, cookies }) => {
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")
    const storedState = cookies.get("oauth_state")

    if (url.searchParams.get("error")) {
        redirect(303, "/login?error=auth_failed")
    }

    if (!code || state !== storedState) {
        throw new Error("Invalid state or missing code")
    }

    const claims = await getTailscaleIdToken(code)

    cookies.set("session", JSON.stringify({
        sub: claims.sub,
        email: claims.email,
        name: claims.name
    }), {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60
    })

    cookies.delete("oauth_state", { path: "/" })
    redirect(303, "/")
}
```

The session cookie is httpOnly — client-side JS can't read it. `sub` is the tailnet user ID. `email` and `name` come from the `profile` scope. If you need custom data in tokens, use `extraClaims` in the ACL grant.

## Session Propagation (`src/routes/+layout.server.ts`)

```ts
import type { LayoutServerLoad } from "./$types"

export const load: LayoutServerLoad = async (event) => {
    return { session: event.locals.user }
}
```

Exposes `event.locals.user` as `$page.data.session` to every page in the app.

## Route Guard (`src/routes/(authenticated)/+layout.server.ts`)

Protected routes go under `src/routes/(authenticated)/`. This layout's load function redirects unauthenticated requests.

```ts
import { redirect } from "@sveltejs/kit"
import type { LayoutServerLoad } from "./$types"

export const load: LayoutServerLoad = async ({ locals }) => {
    if (!locals.user) redirect(303, "/login")
    return {}
}
```

## Logout (`src/routes/logout/+server.ts`)

```ts
import { redirect } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async ({ cookies }) => {
    cookies.delete("session", { path: "/" })
    redirect(303, "/login")
}
```

No server-side session to invalidate — the cookie is the session.

## Auth Flow

```
User → /login
    → oauth_state cookie set
    → redirect to tsidp/authorize
    → User authenticates via Tailscale
    → tsidp redirects to /auth/callback/tailscale?code=...&state=...
    → Callback validates state
    → code exchanged for id_token, verified against JWKS
    → session cookie set, oauth_state deleted
    → redirect to /

Subsequent requests:
    → hooks.server.ts reads session cookie → locals.user
    → (authenticated)/+layout.server.ts checks → allow or redirect
```
