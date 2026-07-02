import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { env } from "$env/dynamic/private";
import { promises as fs } from "fs";
import { join } from "path";

const SCREENSHOT_DEBUG_ENABLED =
  env.SCREENSHOT_DEBUG_ENABLED === "1" || env.SCREENSHOT_DEBUG_ENABLED === "true";
const DEBUG_DIR = env.SCREENSHOT_DEBUG_DIR ?? "/tmp/esphome-screenshots";

interface DeviceScreenshot {
  deviceId: string;
  size: number;
  mtime: number;
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) error(401);
  if (!SCREENSHOT_DEBUG_ENABLED) error(404);

  const devices: DeviceScreenshot[] = [];
  try {
    const entries = await fs.readdir(DEBUG_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".bin")) continue;
      const deviceId = entry.name.replace(/\.bin$/, "");
      const stat = await fs.stat(join(DEBUG_DIR, entry.name));
      devices.push({
        deviceId,
        size: stat.size,
        mtime: stat.mtimeMs,
      });
    }
  } catch {
    // Directory doesn't exist yet — no screenshots captured
  }

  devices.sort((a, b) => b.mtime - a.mtime);

  return { devices, screenshotDebugEnabled: true };
};
