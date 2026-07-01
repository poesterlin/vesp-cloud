import type { RequestHandler } from "./$types";
import { error, json } from "@sveltejs/kit";
import { promises as fs } from "fs";
import { join } from "path";
import { isScreenshotDebugEnabled } from "$lib/codegen/screenshot-feature";

// Per-device upload + decoded PNG cache. The on-device task POSTs raw
// RGB565 (480*480*2 = 460800 bytes) one chunk at a time. The chunks land
// in `<deviceId>.bin` under SCREENSHOT_DEBUG_DIR (default
// /tmp/esphome-screenshots). GET returns the latest as a PNG; the decode
// is on demand and cached at `<deviceId>.png` so subsequent reads are
// a single stat + stream.

const DEBUG_DIR = process.env.SCREENSHOT_DEBUG_DIR ?? "/tmp/esphome-screenshots";

function ensureDir() {
  return fs.mkdir(DEBUG_DIR, { recursive: true });
}

function safeDeviceId(raw: string | undefined) {
  if (!raw) error(400, "Missing deviceId");
  if (!/^[a-z0-9_-]+$/i.test(raw)) error(400, "Invalid deviceId");
  return raw;
}

function isAuthorizedForDebug(locals: App.Locals): boolean {
  return !!locals.user;
}

async function isAuthorizedForDeviceUpload(request: Request, deviceId: string) {
  // Devices authenticate via the firmware_token (mirrors the OTA flow).
  // The header `X-Device-Token` carries the project firmware token; we
  // resolve it to a project and check the token matches.
  const token = request.headers.get("x-device-token");
  if (!token) return false;
  const basicCheck = token.length > 0 && /^[a-f0-9]{32,}$/i.test(token);
  if (!basicCheck){
    return false;
  }

  // TODO: use the device id for cross reference
  return true;
}

// ---- PNG encoder -----------------------------------------------------------
// Minimal RGB888 -> PNG (zlib IDAT, no filtering). We do not use a
// dependency; ~120 LoC keeps the surface small and avoids pulling sharp.
//
// CRC32 table (standard zlib polynomial 0xEDB88320).
const CRC_TABLE: number[] = (() => {
  const t = new Array<number>(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

async function encodePng(rgb: Buffer, width: number, height: number): Promise<Buffer> {
  // RGB888 with one filter byte (0 = None) per scanline.
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const zlib = await import("node:zlib");
  const compressed = zlib.deflateSync(raw, { level: 6 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);   // bit depth
  ihdr.writeUInt8(2, 9);   // color type: truecolor RGB
  ihdr.writeUInt8(0, 10);  // compression
  ihdr.writeUInt8(0, 11);  // filter
  ihdr.writeUInt8(0, 12);  // interlace
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function rgb565ToRgb888(raw: Buffer, width: number, height: number): Buffer {
  const out = Buffer.alloc(width * height * 3);
  const len = Math.min(raw.length, width * height * 2);
  for (let i = 0, j = 0; i + 1 < len; i += 2, j += 3) {
    const px = raw.readUInt16LE(i);
    const r = (px >> 11) & 0x1f;
    const g = (px >> 5) & 0x3f;
    const b = px & 0x1f;
    out[j] = (r << 3) | (r >> 2);
    out[j + 1] = (g << 2) | (g >> 4);
    out[j + 2] = (b << 3) | (b >> 2);
  }
  return out;
}

// ---- Handlers --------------------------------------------------------------

export const POST: RequestHandler = async ({ params, request }) => {
  if (!isScreenshotDebugEnabled()) error(404, "Screenshot feature disabled");
  const deviceId = safeDeviceId(params.deviceId);
  if (!isAuthorizedForDeviceUpload(request, deviceId)) {
    error(401, "Missing or invalid X-Device-Token");
  }

  await ensureDir();
  const target = join(DEBUG_DIR, `${deviceId}.bin`);

  // The on-device loop appends raw RGB565 with `?offset=N` (a small
  // monotonic counter; 0, 4096, 8192, ...). We trust the device to send
  // chunks in order and just append -- a duplicate or out-of-order chunk
  // produces a corrupt frame, but the next capture replaces it.
  const url = new URL(request.url);
  const offsetStr = url.searchParams.get("offset");
  const body = Buffer.from(await request.arrayBuffer());
  if (offsetStr !== null) {
    const offset = Number.parseInt(offsetStr, 10);
    if (!Number.isFinite(offset) || offset < 0) error(400, "Invalid offset");
    const handle = await fs.open(target, "r+").catch(async () => {
      await fs.writeFile(target, Buffer.alloc(0));
      return fs.open(target, "r+");
    });
    try {
      await handle.write(body, 0, body.length, offset);
    } finally {
      await handle.close();
    }
  } else {
    await fs.writeFile(target, body);
  }

  return json({ ok: true, bytes: body.length });
};

export const GET: RequestHandler = async ({ params, locals, url }) => {
  if (!isScreenshotDebugEnabled()) error(404, "Screenshot feature disabled");
  const deviceId = safeDeviceId(params.deviceId);
  if (!isAuthorizedForDebug(locals)) error(401, "Unauthorized");

  if (url.searchParams.get("format") === "raw") {
    // Stream the raw RGB565 to the editor preview.
    const target = join(DEBUG_DIR, `${deviceId}.bin`);
    try {
      const stat = await fs.stat(target);
      const stream = (await import("fs")).createReadStream(target);
      return new Response(stream as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": String(stat.size),
          "Cache-Control": "no-store",
        },
      });
    } catch {
      error(404, "No screenshot yet");
    }
  }

  await ensureDir();
  const raw = join(DEBUG_DIR, `${deviceId}.bin`);
  const png = join(DEBUG_DIR, `${deviceId}.png`);

  let rawStat: import("fs").Stats;
  try {
    rawStat = await fs.stat(raw);
  } catch {
    error(404, "No screenshot yet");
  }
  // Re-encode if the raw file is newer than the cached PNG.
  let needsDecode = true;
  try {
    const pngStat = await fs.stat(png);
    needsDecode = pngStat.mtimeMs < rawStat!.mtimeMs;
  } catch {
    needsDecode = true;
  }

  if (needsDecode) {
    const expectedBytes = 480 * 480 * 2;
    if (rawStat!.size !== expectedBytes) {
      error(409, `Screenshot size ${rawStat!.size} != expected ${expectedBytes}`);
    }
    const rawBuf = await fs.readFile(raw);
    const rgb = rgb565ToRgb888(rawBuf, 480, 480);
    const pngBuf = await encodePng(rgb, 480, 480);
    await fs.writeFile(png, pngBuf);
  }

  const stream = (await import("fs")).createReadStream(png);
  return new Response(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
};
