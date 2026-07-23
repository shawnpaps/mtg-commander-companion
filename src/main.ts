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

// Clerk's modals render over a near-black board, so tint them to match rather
// than letting the default light theme punch a hole in the UI.
app.use(clerkPlugin, {
  publishableKey: clerkKey,
  appearance: {
    variables: {
      colorPrimary: "#a78bfa",
      colorBackground: "#14141c",
      colorText: "#f4f4f5",
      colorTextSecondary: "#a1a1aa",
      colorInputBackground: "#0a0a0f",
      colorInputText: "#f4f4f5",
      colorNeutral: "#ffffff",
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
