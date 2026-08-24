import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // All /api/* requests are forwarded to the Express backend.
      // This eliminates cross-origin issues in development and means
      // the frontend never makes raw requests to localhost:5000.
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        // Preserve the /api prefix — backend routes are mounted at /api/*
        rewrite: (path) => path,
      },
    },
  },
});
