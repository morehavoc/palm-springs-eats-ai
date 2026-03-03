import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: ["jaws-mini", "jaws-mini.daggertooth-uaru.ts.net"],
  },
  build: {
    target: "esnext",
  },
});
