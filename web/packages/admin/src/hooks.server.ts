import { getDb } from "@esphome-designer/db";
import { env } from "$env/dynamic/private";
import { sequence } from "@sveltejs/kit/hooks";
import type { Handle } from "@sveltejs/kit";

let initialized = false;

if (!initialized) {
    getDb(env.DATABASE_URL);
    initialized = true;
    console.log("Admin database ready");
}

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
