import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { build as buildWithEsbuild } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { toFirefoxManifest } from "./src/build/firefoxManifest";

type BuildTarget = "chrome" | "firefox";

export default defineConfig(({ mode }) => {
  const target: BuildTarget = mode === "firefox" ? "firefox" : "chrome";
  const outDir = target === "firefox" ? "dist-firefox" : "dist";
  const input: Record<string, string> = {
    popup: new URL("./popup.html", import.meta.url).pathname,
    options: new URL("./options.html", import.meta.url).pathname,
    guide: new URL("./guide.html", import.meta.url).pathname,
    "content/index": new URL("./src/content/index.ts", import.meta.url).pathname,
  };

  if (target === "chrome") {
    input["background/index"] = new URL("./src/background/index.ts", import.meta.url).pathname;
  }

  return {
    publicDir: "public",
    plugins: [
      bundleClassicScripts(outDir, target),
      ...(target === "firefox" ? [writeFirefoxManifest(outDir)] : []),
    ],
    build: {
      emptyOutDir: true,
      outDir,
      rollupOptions: {
        input,
        output: {
          assetFileNames: (assetInfo) =>
            assetInfo.name === "index.css" ? "assets/content.css" : "assets/[name][extname]",
          chunkFileNames: "chunks/[name].js",
          entryFileNames: "[name].js",
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      include: ["src/**/*.test.ts"],
      // Let tests read content.css via `?raw` to guard skin compatibility.
      css: { include: [/content\.css/] },
    },
  };
});

function bundleClassicScripts(outDir: string, target: BuildTarget): Plugin {
  return {
    name: "ao3th-classic-scripts",
    apply: "build",
    closeBundle: async () => {
      await buildClassicScript("src/content/index.ts", `${outDir}/content/index.js`, {
        ".css": "empty",
      });
      if (target === "firefox") {
        await buildClassicScript("src/background/index.ts", `${outDir}/background/index.js`);
      }
    },
  };
}

function writeFirefoxManifest(outDir: string): Plugin {
  return {
    name: "ao3th-firefox-manifest",
    apply: "build",
    closeBundle: async () => {
      const manifestPath = `${outDir}/manifest.json`;
      const base = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
      await writeFile(manifestPath, `${JSON.stringify(toFirefoxManifest(base), null, 2)}\n`);
    },
  };
}

async function buildClassicScript(
  entryPoint: string,
  outfile: string,
  loader?: Record<string, "empty">
): Promise<void> {
  await buildWithEsbuild({
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    format: "iife",
    target: "es2022",
    minify: true,
    ...(loader ? { loader } : {}),
  });
}
