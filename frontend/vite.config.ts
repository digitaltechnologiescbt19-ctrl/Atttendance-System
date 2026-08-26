import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Development only: proxy /api to local Express backend.
    // In production (Vercel), VITE_API_URL is set to the Render backend URL
    // and the frontend calls it directly — no proxy needed.
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
});
