import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standalone build for the CHUD sub-app.
// Outputs to public/chud/ so the main build picks it up as a static asset.
export default defineConfig({
  base: "./",
  publicDir: false,
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: "public/chud",
    emptyOutDir: false,
    rollupOptions: {
      input: {
        // "index" key → output file is public/chud/index.html
        index: path.resolve(__dirname, "chud.html"),
      },
      output: {
        entryFileNames: "assets/chud-app.js",
        chunkFileNames: "assets/chud-chunk-[hash].js",
        assetFileNames: "assets/chud-app.[ext]",
      },
    },
  },
  plugins: [react()],
});
