import type { LayoutServerLoad } from "./$types"
import { env } from "$env/dynamic/private"

export const load: LayoutServerLoad = async (event) => {
    return {
        session: event.locals.user,
        screenshotDebugEnabled: env.SCREENSHOT_DEBUG_ENABLED === "1" || env.SCREENSHOT_DEBUG_ENABLED === "true",
    }
}
