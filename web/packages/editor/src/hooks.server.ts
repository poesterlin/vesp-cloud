import { startWorker, stopWorker } from "$lib/utils/worker";
import type { Handle } from "@sveltejs/kit";
import { getDb } from "./lib/db";
import * as auth from "$lib/server/auth";

let workerStarted = false;

// Initialize database and start worker on server startup
if (!workerStarted) {
  (async () => {
    try {
      console.log("Initializing database...");
      getDb();
      console.log("Database ready");

      startWorker(parseInt(process.env.CONCURRENT_JOBS || "2"));
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

export const handle: Handle = handleAuth;
