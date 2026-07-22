import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { fileURLToPath, URL } from "node:url";

// Source maps are only uploaded when an auth token is present, so a plain
// `npm run build` (local, or CI without the secret) still works.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

export default defineConfig({
  build: {
    sourcemap: Boolean(sentryAuthToken),
  },
  plugins: [
    vue(),
    tailwindcss(),
    ...(sentryAuthToken
      ? [
          sentryVitePlugin({
            org: "spap-technology-solutions",
            project: "boardstate",
            authToken: sentryAuthToken,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@convex": fileURLToPath(new URL("./convex", import.meta.url)),
    },
  },
});
