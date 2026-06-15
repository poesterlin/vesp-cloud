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
