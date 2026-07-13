import { getDb } from "@vesp-cloud/db";
import { env } from "$env/dynamic/private";
import { sequence } from "@sveltejs/kit/hooks";
import type { Handle } from "@sveltejs/kit";
import * as Sentry from "@sentry/sveltekit";

const sentryEnabled = !!env.SENTRY_DSN;

if (sentryEnabled) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: env.APP_EDITION || "development",
  });
}

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

const handles: Handle[] = [];
if (sentryEnabled) {
  handles.push(Sentry.sentryHandle());
}
handles.push(authHandle);

export const handle = sequence(...handles);
export const handleError = Sentry.handleErrorWithSentry();
