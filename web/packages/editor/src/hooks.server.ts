import { startWorker, stopWorker } from "$lib/utils/worker";
import { building } from "$app/environment";
import { json, type Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { getDb } from "@vesp-cloud/db";
import * as auth from "$lib/server/auth";
import { env } from "$env/dynamic/private";
import * as Sentry from "@sentry/sveltekit";

const sentryEnabled = !!env.SENTRY_DSN;

if (sentryEnabled) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: env.APP_EDITION || "development",
  });
}

let workerStarted = false;
const configuredCompilerMode = (env.COMPILER_MODE ?? "embedded").toLowerCase();
const compilerMode = configuredCompilerMode === "external" ? "external" : "embedded";
const runEmbeddedWorker = compilerMode === "embedded";

// Initialize database and start worker on server startup (runtime only)
if (!building && !workerStarted) {
  (async () => {
    try {
      console.log("Initializing database...");
      getDb(env.DATABASE_URL);
      console.log("Database ready");

      if (runEmbeddedWorker) {
        startWorker(parseInt(env.CONCURRENT_JOBS || "2"));
        console.log("Worker started (embedded mode)");
      } else {
        console.log(`Worker startup skipped (COMPILER_MODE=${compilerMode})`);
      }

      workerStarted = true;
    } catch (error) {
      console.error("Failed to initialize:", error);
      process.exit(1);
    }
  })();

  process.on("SIGTERM", async () => {
    console.log("SIGTERM received");
    await stopWorker();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("SIGINT received");
    await stopWorker();
    process.exit(0);
  });
}

const handleCsrf: Handle = async ({ event, resolve }) => {
  const method = event.request.method;
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return resolve(event);
  }

  const origin = event.request.headers.get('origin');
  if (!origin) return resolve(event);

  const url = new URL(event.request.url);
  const host = event.request.headers.get('host') || url.host;

  try {
    const originUrl = new URL(origin);
    if (originUrl.host !== host) {
      return json({ error: 'CSRF check failed' }, { status: 403 });
    }
  } catch {
    return json({ error: 'Invalid origin' }, { status: 403 });
  }

  return resolve(event);
};

const handleAuth: Handle = async ({ event, resolve }) => {
  const sessionToken = event.cookies.get(auth.sessionCookieName);
  if (!sessionToken) {
    event.locals.user = null;
    event.locals.session = null;
    return resolve(event);
  }

  const { session, user } = await auth.validateSessionToken(sessionToken);
  if (session) {
    auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
  } else {
    auth.deleteSessionTokenCookie(event);
  }

  event.locals.user = user;
  event.locals.session = session;

  return resolve(event);
};

const appHandles: Handle[] = [];
if (sentryEnabled) {
  appHandles.push(Sentry.sentryHandle());
}
appHandles.push(handleCsrf, handleAuth);

export const handle: Handle = sequence(...appHandles);
export const handleError = Sentry.handleErrorWithSentry();
