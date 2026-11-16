import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base: the folder the site is served from.
//   - local development: "/"
//   - GitHub Pages: "/devops/" (set by .github/workflows/deploy.yml through VITE_BASE_PATH)
// The dev server forwards /api/* to the FastAPI backend, so local development uses relative URLs.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
});
