import { defineConfig } from "vite";
export default defineConfig({
  base: process.env.BASE_PATH || "/EQUINOX/",
  build: { target: "safari17", sourcemap: true },
});
