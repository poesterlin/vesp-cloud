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
