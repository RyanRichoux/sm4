import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the API runs separately; the browser still sees one origin.
    proxy: { "/api": { target: "http://localhost:8080", changeOrigin: false }, "/healthz": "http://localhost:8080" },
  },
  build: { outDir: "dist", sourcemap: true },
});
