import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { build as buildWithEsbuild } from "esbuild";

export default defineConfig({
  publicDir: "public",
  plugins: [bundleContentScriptAsClassicScript()],
  build: {
    emptyOutDir: true,
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: new URL("./popup.html", import.meta.url).pathname,
        options: new URL("./options.html", import.meta.url).pathname,
        guide: new URL("./guide.html", import.meta.url).pathname,
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

function bundleContentScriptAsClassicScript(): Plugin {
  return {
    name: "ao3th-content-classic-script",
    apply: "build",
    closeBundle: async () => {
      await buildWithEsbuild({
        entryPoints: ["src/content/index.ts"],
        outfile: "dist/content/index.js",
        bundle: true,
        format: "iife",
        target: "es2022",
        minify: true,
        loader: {
          ".css": "empty"
        }
      });
    }
  };
}
