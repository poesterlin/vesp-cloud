import { generateESPHomeYAML } from './packages/editor/src/lib/codegen/esphome.ts';

const project = {
  version: "1.0.1",
  id: "test-display",
  name: "Test Display",
  display: {
    width: 240,
    height: 320,
    platform: "st7789"
  },
  dashboardPages: [
    {
      id: "page-1",
      name: "Status",
      components: []
    }
  ],
  detailViews: []
};

try {
  const yaml = generateESPHomeYAML(project);
  console.log("Generated YAML:");
  console.log(yaml);
} catch (e) {
  console.error("Error:", e.message);
}
