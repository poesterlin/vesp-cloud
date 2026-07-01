import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isScreenshotDebugEnabled } from "$lib/codegen/screenshot-feature";
import { listScreenshotDevices } from "$lib/server/s3";

export const GET: RequestHandler = async () => {
  if (!isScreenshotDebugEnabled()) error(404, "Screenshot feature disabled");

  const devices = await listScreenshotDevices();
  devices.sort((a, b) => b.mtime - a.mtime);

  return json(devices);
};
