import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { env } from "$env/dynamic/private";
import { listScreenshots, getScreenshotBuffer } from "$lib/server/s3";
import JSZip from "jszip";

const SCREENSHOT_DEBUG_ENABLED =
  env.SCREENSHOT_DEBUG_ENABLED === "1" || env.SCREENSHOT_DEBUG_ENABLED === "true";

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
    const px = raw.readUInt16BE(i);
    const r = (px >> 11) & 0x1f;
    const g = (px >> 5) & 0x3f;
    const b = px & 0x1f;
    out[j] = (r << 3) | (r >> 2);
    out[j + 1] = (g << 2) | (g >> 4);
    out[j + 2] = (b << 3) | (b >> 2);
  }
  return out;
}

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) error(401);
  if (!SCREENSHOT_DEBUG_ENABLED) error(404);

  const names = await listScreenshots();
  const zip = new JSZip();

  for (const name of names) {
    const raw = await getScreenshotBuffer(name);
    if (raw == null || raw.length !== 480 * 480 * 2) continue;
    const rgb = rgb565ToRgb888(raw, 480, 480);
    const png = await encodePng(rgb, 480, 480);
    zip.file(name.replace(/\.bin$/, ".png"), png);
  }

  if (Object.keys(zip.files).length === 0) error(404, "No screenshots");

  const buf = Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  return new Response(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=screenshots.zip",
      "Cache-Control": "no-store",
    },
  });
};
