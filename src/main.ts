import { createApp } from "vue";
import * as Sentry from "@sentry/vue";
import App from "./App.vue";
import "./style.css";

const app = createApp(App);

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
