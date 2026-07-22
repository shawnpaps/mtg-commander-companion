import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { fileURLToPath, URL } from "node:url";

// Source maps are only uploaded when an auth token is present, so a plain
// `npm run build` (local, or CI without the secret) still works.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

// Link previews need absolute URLs, so index.html carries a %SITE_URL%
// placeholder that gets stamped at build time. Set SITE_URL in the deploy
// environment; this fallback is what a local build gets.
const SITE_URL = (process.env.SITE_URL ?? "https://boardstate.app").replace(
  /\/$/,
  "",
);

function siteUrlHtml() {
  return {
    name: "stamp-site-url",
    transformIndexHtml: {
      order: "pre" as const,
      handler: (html: string) => html.replaceAll("%SITE_URL%", SITE_URL),
    },
  };
}

export default defineConfig({
  build: {
    sourcemap: Boolean(sentryAuthToken),
  },
  plugins: [
    vue(),
    tailwindcss(),
    siteUrlHtml(),
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
