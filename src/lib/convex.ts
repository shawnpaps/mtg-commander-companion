import { ConvexClient } from "convex/browser";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;

if (!url) {
  throw new Error(
    "VITE_CONVEX_URL is not set. Copy .env.local.example to .env.local, or run `npx convex dev`.",
  );
}

export const convex = new ConvexClient(url);
