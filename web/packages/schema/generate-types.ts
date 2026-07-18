/**
 * Type Generator for vESP.cloud
 *
 * Generates TypeScript types from the JSON Schema.
 * Run: bun run generate-types.ts
 */

import { compile } from "json-schema-to-typescript";
import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function generate() {
  console.log("Reading schema...");

  const schemaPath = join(__dirname, "components.json");
  const schemaText = await readFile(schemaPath, "utf-8");
  const schema = JSON.parse(schemaText);

  console.log("Generating TypeScript types...");

  // Generate types for Project definition (which includes all nested types)
  const projectSchema = {
    ...schema.definitions.Project,
    definitions: schema.definitions,
  };

  const ts = await compile(projectSchema, "Project", {
    additionalProperties: false,
    bannerComment: `/**
 * AUTO-GENERATED - DO NOT EDIT
 *
 * Generated from components.json schema
 * Run: bun run generate:types
 */`,
    style: {
      semi: true,
      singleQuote: false,
    },
    declareExternallyReferenced: true,
    enableConstEnums: true,
  });

  // Ensure dist directory exists
  const distDir = join(__dirname, "dist");
  await mkdir(distDir, { recursive: true });

  // Write the generated types
  const outputPath = join(distDir, "types.ts");
  await writeFile(outputPath, ts);

  console.log(`Generated: ${outputPath}`);

  // Also generate a convenience re-export index
  const indexContent = `/**
 * vESP.cloud Schema Types
 *
 * Re-exports all generated types for convenient importing.
 */

export * from "./types.js";

// Re-export component type discriminators for type guards
export type ComponentType =
  | "text"
  | "button"
  | "icon"
  | "rectangle"
  | "image"
  | "todo_list"
  | "light_state"
  | "hvac"
  | "weather"
  | "conditional_area"
  | "tab_container";

export function isTextComponent(c: Component): c is TextComponent {
  return c.type === "text";
}

export function isButtonComponent(c: Component): c is ButtonComponent {
  return c.type === "button";
}

export function isIconComponent(c: Component): c is IconComponent {
  return c.type === "icon";
}

export function isHvacComponent(c: Component): c is HvacComponent {
  return c.type === "hvac";
}

export function isWeatherComponent(c: Component): c is WeatherComponent {
  return c.type === "weather";
}

import type {
  Component,
  TextComponent,
  ButtonComponent,
  IconComponent,
  HvacComponent,
  WeatherComponent,
} from "./types.js";
`;

  await writeFile(join(distDir, "index.ts"), indexContent);
  console.log(`Generated: ${join(distDir, "index.ts")}`);

  console.log("Done!");
}

generate().catch((err) => {
  console.error("Type generation failed:", err);
  process.exit(1);
});
