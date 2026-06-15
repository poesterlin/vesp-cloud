import { env } from "$env/dynamic/private"
import { jwtVerify, createRemoteJWKSet } from "jose"
import crypto from "crypto"
import { dev } from "$app/environment"

function requireEnv(value: string | undefined, name: string): string {
    if (!value) throw new Error(`${name} is not set`)
    return value
}

const issuer = requireEnv(env.TSIDP_ISSUER, "TSIDP_ISSUER")
const clientId = requireEnv(env.TSIDP_CLIENT_ID, "TSIDP_CLIENT_ID")
const clientSecret = requireEnv(env.TSIDP_CLIENT_SECRET, "TSIDP_CLIENT_SECRET")
const baseUrl = requireEnv(env.URL, "URL")

const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))

export async function getTailscaleIdToken(code: string) {
    const host = dev ? "http://localhost:5173" : baseUrl

    const response = await fetch(`${env.TSIDP_ISSUER}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams([
            ["grant_type", "authorization_code"],
            ["code", code],
            ["client_id", clientId],
            ["client_secret", clientSecret],
            ["redirect_uri", `${host}/auth/callback/tailscale`]
        ])
    })

    if (!response.ok) throw new Error("Token exchange failed")

    const { id_token } = await response.json()
    const verified = await jwtVerify(id_token, jwks, {
        issuer,
        audience: clientId
    })
    return verified.payload
}

export function generateState(): string {
    return crypto.randomBytes(32).toString("hex")
}

export function getTailscaleAuthUrl(state: string): string {
    const host = dev ? "http://localhost:5173" : baseUrl

    const params = new URLSearchParams([
        ["client_id", clientId],
        ["response_type", "code"],
        ["scope", "openid profile email"],
        ["redirect_uri", `${host}/auth/callback/tailscale`],
        ["state", state]
    ])
    return `${issuer}/authorize?${params}`
}
