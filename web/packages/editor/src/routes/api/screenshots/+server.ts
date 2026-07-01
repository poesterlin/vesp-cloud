import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isScreenshotDebugEnabled } from "$lib/codegen/screenshot-feature";
import { listScreenshots } from "$lib/server/s3";

export const GET: RequestHandler = async () => {
  if (!isScreenshotDebugEnabled()) error(404);
  return json(await listScreenshots());
};
