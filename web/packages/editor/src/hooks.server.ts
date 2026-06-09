import { startWorker, stopWorker } from "$lib/utils/worker";
import { sequence, json, type Handle } from "@sveltejs/kit";
import { getDb } from "./lib/db";
import * as auth from "$lib/server/auth";
import { env } from "$env/dynamic/private";

let workerStarted = false;

// Initialize database and start worker on server startup
if (!workerStarted) {
  (async () => {
    try {
      console.log("Initializing database...");
      getDb();
      console.log("Database ready");

      startWorker(parseInt(env.CONCURRENT_JOBS || "2"));
      workerStarted = true;
      console.log("Worker started");
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

export const handle: Handle = sequence(handleCsrf, handleAuth);
