import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { env } from "$env/dynamic/private";
import { listScreenshots } from "$lib/server/s3";

const SCREENSHOT_DEBUG_ENABLED =
  env.SCREENSHOT_DEBUG_ENABLED === "1" || env.SCREENSHOT_DEBUG_ENABLED === "true";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) error(401);
  if (!SCREENSHOT_DEBUG_ENABLED) error(404);

  return { names: await listScreenshots(), screenshotDebugEnabled: true };
};
