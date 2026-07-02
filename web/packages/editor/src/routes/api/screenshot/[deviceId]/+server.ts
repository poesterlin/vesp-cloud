import type { RequestHandler } from "./$types";
import { error, json } from "@sveltejs/kit";
import { isScreenshotDebugEnabled } from "$lib/codegen/screenshot-feature";
import { uploadScreenshot, getScreenshotBuffer } from "$lib/server/s3";
import { promises as fs } from "fs";
import { join } from "path";

function safeDeviceId(raw: string | undefined): string {
  if (!raw) error(400, "Missing deviceId");
  if (!/^[a-z0-9_-]+$/i.test(raw)) error(400, "Invalid deviceId");
  return raw;
}

// ---- PNG encoder -----------------------------------------------------------
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
    const px = raw.readUInt16BE(i);   // ST7701S framebuffer uses big-endian RGB565
    const r = (px >> 11) & 0x1f;
    const g = (px >> 5) & 0x3f;
    const b = px & 0x1f;
    out[j] = (r << 3) | (r >> 2);
    out[j + 1] = (g << 2) | (g >> 4);
    out[j + 2] = (b << 3) | (b >> 2);
  }
  return out;
}

const DEBUG_DIR = process.env.SCREENSHOT_DEBUG_DIR ?? "/tmp/esphome-screenshots";

// ---- Handlers --------------------------------------------------------------

// POST — device uploads raw RGB565 to S3 + local disk as fallback.
export const POST: RequestHandler = async ({ params, request }) => {
  if (!isScreenshotDebugEnabled()) error(404, "Screenshot feature disabled");
  const deviceId = safeDeviceId(params.deviceId);

  const body = Buffer.from(await request.arrayBuffer());
  // Do the S3 upload first; the local path is optional but harmless.
  await uploadScreenshot(deviceId, body);

  await fs.mkdir(DEBUG_DIR, { recursive: true });
  const target = join(DEBUG_DIR, `${deviceId}.bin`);
  const url = new URL(request.url);
  const offsetStr = url.searchParams.get("offset");
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

// GET — returns PNG decoded from the raw RGB565 in S3.
export const GET: RequestHandler = async ({ params, locals, url }) => {
  if (!isScreenshotDebugEnabled()) error(404, "Screenshot feature disabled");
  const deviceId = safeDeviceId(params.deviceId);
  const tsParam = url.searchParams.get("ts");
  const timestamp = tsParam ? Number.parseInt(tsParam, 10) : undefined;

  const rawBuf = await getScreenshotBuffer(deviceId, Number.isFinite(timestamp as number) ? timestamp : undefined);
  if (rawBuf == null) error(404, "No screenshot for this device");

  if (url.searchParams.get("format") === "raw") {
    return new Response(rawBuf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(rawBuf.length),
        "Cache-Control": "no-store",
      },
    });
  }

  const expectedBytes = 480 * 480 * 2;
  if (rawBuf.length !== expectedBytes) {
    error(409, `Screenshot size ${rawBuf.length} != expected ${expectedBytes}`);
  }
  const rgb = rgb565ToRgb888(rawBuf, 480, 480);
  const png = await encodePng(rgb, 480, 480);
  return new Response(png as unknown as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
};
