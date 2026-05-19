import { defineConfig } from "vite";

export default defineConfig({
  publicDir: "public",
  build: {
    emptyOutDir: true,
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: new URL("./popup.html", import.meta.url).pathname,
        options: new URL("./options.html", import.meta.url).pathname,
        "background/index": new URL("./src/background/index.ts", import.meta.url).pathname,
        "content/index": new URL("./src/content/index.ts", import.meta.url).pathname
      },
      output: {
        assetFileNames: (assetInfo) =>
          assetInfo.name === "index.css" ? "assets/content.css" : "assets/[name][extname]",
        chunkFileNames: "chunks/[name].js",
        entryFileNames: "[name].js"
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts"]
  }
});
