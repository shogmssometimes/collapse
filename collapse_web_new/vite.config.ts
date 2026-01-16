import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Keep a single React instance and make HMR work under the production base path.
// The repo is published to https://shogmssometimes.github.io/fancybuild_clean/ by default.
const defaultBasePath = "/fancybuild_clean/";
const base = process.env.VITE_BASE_PATH || defaultBasePath;

export default defineConfig({
  base,
  resolve: {
    dedupe: ["react", "react-dom"]
  },
  server: {
    hmr: {
      path: "/hmr" // avoid ws path collisions when serving under the project base path
    }
  },
  build: {
    outDir: "docs",
    emptyOutDir: true,
    rollupOptions: {
        input: {
          main: path.resolve(__dirname, "index.html"),
          gm: path.resolve(__dirname, "gm.html"),
        },
    },
  },
  plugins: [react()]
});
