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
      if (dockerfile === "Dockerfile") {
        expect(source).toContain(
          "COPY --from=builder /opt/esphome-patches /opt/esphome-patches",
        );
      }
      expect(source).not.toContain("cat > /tmp/warmup/warmup.yaml");
    }
  });

  test("isolates the native IDF environment by ESPHome version", () => {
    for (const dockerfile of ["Dockerfile", "Dockerfile.worker"]) {
      const source = readEditorFile(dockerfile);

      expect(source).toContain("ARG ESPHOME_VERSION=2026.7.1");
      expect(source).toContain("ENV ESPHOME_VERSION=${ESPHOME_VERSION}");
      expect(source).toContain(
        "ENV ESPHOME_ESP_IDF_PREFIX=/data/esphome/${ESPHOME_VERSION}/idf",
      );
      expect(source).not.toContain("ENV ESPHOME_ESP_IDF_PREFIX=/data/idf");
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

    expect(installer).toContain('EXPECTED_ESPHOME_VERSION = "2026.7.1"');
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
    const pnglePatch = readEditorFile("esphome-patches/patch-pngle.py");

    expect(installer).toContain('PATCH_DIR / "png_decoder.cpp"');
    expect(installer).toContain('PATCH_DIR / "png_decoder.h"');
    expect(installer).toContain('cg.add_platformio_option("extra_scripts"');
    expect(header).toContain("target_x_for_source_boundary_");
    expect(decoder).toContain("get_decode_buffer()");
    expect(decoder).toContain("!this->image_->has_transparency()");
    expect(decoder).not.toContain("std::lower_bound");
    expect(decoder).toContain("this->draw(x, y, width, height, Color(");
    expect(decoder).toContain('"Fast RGB565: source=%" PRIu32');
    expect(decoder).toContain("pngle_set_draw_boundaries");
    expect(decoder).toContain("#ifdef VESP_PATCHED_PNGLE");
    expect(pnglePatch).toContain("skip color conversion and callbacks");
    expect(pnglePatch).toContain("continue;");
    expect(pnglePatch).toContain('env.Append(CPPDEFINES=["VESP_PATCHED_PNGLE"])');
  });

  test("patches the final ST7701S class with narrow framebuffer access", () => {
    const installer = readEditorFile("esphome-patches/apply-fast-jpeg.py");
    const camera = readEditorFile(
      "src/lib/templates/components/framebuffer_camera/framebuffer_camera.cpp",
    );

    expect(installer).toContain('ST7701S_HEADER = (');
    expect(installer).toContain('get_framebuffer(void **buffer)');
    expect(camera).toContain("panel->get_framebuffer(&framebuffer)");
    expect(camera).not.toContain("ST7701SFramebufferAccess");
  });
});
