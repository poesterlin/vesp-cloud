import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { env } from "$env/dynamic/private";
import { promises as fs } from "fs";
import { join } from "path";

const SCREENSHOT_DEBUG_ENABLED =
  env.SCREENSHOT_DEBUG_ENABLED === "1" || env.SCREENSHOT_DEBUG_ENABLED === "true";
const DEBUG_DIR = env.SCREENSHOT_DEBUG_DIR ?? "/tmp/esphome-screenshots";

// --- PNG encoder -------------------------------------------------------------
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
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(2, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
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

// --- Handler -----------------------------------------------------------------

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) error(401);
  if (!SCREENSHOT_DEBUG_ENABLED) error(404);

  const deviceId = params.deviceId;
  if (!deviceId || !/^[a-z0-9_-]+$/i.test(deviceId)) error(400, "Invalid deviceId");

  const raw = join(DEBUG_DIR, `${deviceId}.bin`);
  const png = join(DEBUG_DIR, `${deviceId}.png`);

  let rawStat: import("fs").Stats;
  try {
    rawStat = await fs.stat(raw);
  } catch {
    error(404, "No screenshot for this device");
  }

  let needsDecode = true;
  try {
    const pngStat = await fs.stat(png);
    needsDecode = pngStat.mtimeMs < rawStat.mtimeMs;
  } catch {
    needsDecode = true;
  }

  if (needsDecode) {
    const expectedBytes = 480 * 480 * 2;
    if (rawStat.size !== expectedBytes) {
      error(409, `Screenshot size ${rawStat.size} != expected ${expectedBytes}`);
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
