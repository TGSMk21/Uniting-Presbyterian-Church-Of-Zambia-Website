import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Capacitor loads the built files from the phone, so paths must be relative.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { target: "es2022", outDir: "dist", sourcemap: false },
  server: { host: "127.0.0.1", port: 5180 },
});
