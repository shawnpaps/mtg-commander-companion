import { createApp } from "vue";
import * as Sentry from "@sentry/vue";
import { clerkPlugin } from "@clerk/vue";
import App from "./App.vue";
import "./style.css";

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;

if (!clerkKey) {
  throw new Error(
    "VITE_CLERK_PUBLISHABLE_KEY is not set. Add it to .env.local — see README.",
  );
}

const app = createApp(App);

// Clerk's modals render over a near-black board, so they have to be dark too.
//
// Two things make this work, and both were wrong before:
//
// 1. `colorForeground` defaults to `inherit`. The earlier config set the legacy
//    name `colorText`, which Clerk ignores, so the modal's text colour fell
//    through to the page default — and that default flips with the OS colour
//    scheme, which is why the menus went unreadable specifically when the system
//    preferred dark. `colorForeground` / `colorMutedForeground` /
//    `colorInputForeground` / `colorInput` are the current names; the legacy
//    `colorText` / `colorTextSecondary` / `colorInputText` / `colorInputBackground`
//    are silently dropped.
//
// 2. `colorNeutral` seeds every derived shade — borders, hover fills, dropdown
//    highlights. It defaults to black, which is meant for light themes; a dark
//    theme has to flip it to white or those shades vanish into the background.
//
// This is the same set of variables Clerk's own `dark` theme sets, so there's no
// need to depend on `@clerk/ui` for it. To re-check the names against the source,
// `npm i -D @clerk/ui` and read `dist/internal/appearance.d.ts` — but don't leave
// it installed: @clerk/vue types `appearance` as `Appearance<Ui>`, which resolves
// to the wrong shape and fails the build.
app.use(clerkPlugin, {
  publishableKey: clerkKey,
  appearance: {
    variables: {
      colorPrimary: "#a78bfa",
      colorPrimaryForeground: "#0a0a0f",
      colorBackground: "#181821",
      colorForeground: "#f3f3f8",
      colorMutedForeground: "#9695a5",
      colorMuted: "#212129",
      colorInput: "#0a0a0f",
      colorInputForeground: "#f3f3f8",
      colorBorder: "#3c3b47",
      colorNeutral: "white",
      colorRing: "#a78bfa",
      colorModalBackdrop: "rgba(0, 0, 0, 0.72)",
      borderRadius: "0.75rem",
    },
  },
});

Sentry.init({
  app,
  dsn: "https://d50ed50ec25fad41f1bef98f3c509073@o4511095586816000.ingest.us.sentry.io/4511780015177728",
  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/vue/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: []
  },
});

app.mount("#app");
