import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import devtoolsJson from 'vite-plugin-devtools-json';
import { sentrySvelteKit } from "@sentry/sveltekit";

export default defineConfig({
  plugins: [
    sentrySvelteKit({ autoUploadSourceMaps: false }),
    devtoolsJson(),
    sveltekit()
  ],
  server: {
    port: 5173,
    host: true,
  },
});
