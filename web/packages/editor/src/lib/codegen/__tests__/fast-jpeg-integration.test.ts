/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const editorRoot = join(import.meta.dir, "../../../..");
const readEditorFile = (path: string) => readFileSync(join(editorRoot, path), "utf8");

describe("fast runtime image firmware integration", () => {
  test("pins the S3 performance settings in generated firmware", () => {
    const baseYaml = readEditorFile("src/lib/templates/base.yaml");

    expect(baseYaml).toContain("cpu_frequency: 240MHz");
    expect(baseYaml).toContain("compiler_optimization: PERF");
  });

  test("installs the pinned ESPHome patch in both compiler images", () => {
    for (const dockerfile of ["Dockerfile", "Dockerfile.worker"]) {
      const source = readEditorFile(dockerfile);

      expect(source).toContain("COPY packages/editor/esphome-patches /opt/esphome-patches");
      expect(source).toContain("/opt/esphome-patches/apply-fast-jpeg.py");
      expect(source).toContain("RUN /bin/sh /opt/esphome-patches/warmup.sh");
      expect(source).not.toContain("cat > /tmp/warmup/warmup.yaml");
    }
  });

  test("precompiles the complete image toolchain from one shared fixture", () => {
    const warmup = readEditorFile("esphome-patches/warmup.sh");

    expect(warmup).toContain("cpu_frequency: 240MHz");
    expect(warmup).toContain("compiler_optimization: PERF");
    expect(warmup).toContain("format: jpeg");
    expect(warmup).toContain("format: png");
    expect(warmup).not.toContain("esphome compile \"$WARMUP_DIR/warmup.yaml\" || true");
  });

  test("keeps native RGB565 scaling and S3 SIMD enabled", () => {
    const installer = readEditorFile("esphome-patches/apply-fast-jpeg.py");
    const decoder = readEditorFile("esphome-patches/jpeg_decoder.cpp");

    expect(installer).toContain('EXPECTED_ESPHOME_VERSION = "2026.5.2"');
    expect(installer).toContain('cg.add_build_flag("-DARDUINO_ARCH_ESP32")');
    expect(installer).toContain('cg.add_build_flag("-DARDUINO_ESP32S3_DEV")');
    expect(decoder).toContain("JPEG_SCALE_EIGHTH");
    expect(decoder).toContain("jpeg->iWidthUsed");
    expect(decoder).toContain("get_decode_buffer()");
    expect(decoder).toContain('"Fast RGB565: source=%dx%d');
  });

  test("installs direct RGB565 PNG output with compatibility fallback", () => {
    const installer = readEditorFile("esphome-patches/apply-fast-jpeg.py");
    const header = readEditorFile("esphome-patches/png_decoder.h");
    const decoder = readEditorFile("esphome-patches/png_decoder.cpp");

    expect(installer).toContain('PATCH_DIR / "png_decoder.cpp"');
    expect(installer).toContain('PATCH_DIR / "png_decoder.h"');
    expect(header).toContain("source_x_for_target_");
    expect(decoder).toContain("get_decode_buffer()");
    expect(decoder).toContain("!this->image_->has_transparency()");
    expect(decoder).toContain("this->draw(x, y, width, height, Color(");
    expect(decoder).toContain('"Fast RGB565: source=%" PRIu32');
  });
});
