import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test as base, chromium, type BrowserContext, type Page, type Worker } from "@playwright/test";
import type { Rule } from "../../src/core/types";

const ROOT = join(import.meta.dirname, "..", "..");
const DIST = join(ROOT, "dist");
const FIXTURES = join(ROOT, "e2e", "fixtures");

export const AO3_ORIGIN = "https://archiveofourown.org";
export const SKINS = ["default", "reversi"] as const;
export type Skin = (typeof SKINS)[number];

/** Captured pages (e2e/scripts/capture-fixtures.mjs), keyed by AO3 pathname. */
export const AO3_PAGES = {
  tagWorks: "/tags/Alternate%20Universe%20-%20No%20Voldemort%20(Harry%20Potter)/works",
  work: "/works/94339886",
} as const;

const PAGE_FILES: Record<string, string> = {
  [AO3_PAGES.tagWorks]: "tag-works.html",
  [AO3_PAGES.work]: "work.html",
};

const DEFAULT_SKIN_STYLESHEET = "/stylesheets/skins/skin_1_default/1_site_screen_.css";
// AO3 layers a chosen site skin on top of the default skin's stylesheets.
const SKIN_STYLESHEETS: Record<Skin, string | null> = {
  default: null,
  reversi: "/e2e/skins/reversi.css",
};

const fixture = (...parts: string[]) => readFileSync(join(FIXTURES, ...parts), "utf8");

interface ExtensionFixtures {
  skin: Skin;
  serviceWorker: Worker;
}

export const test = base.extend<ExtensionFixtures>({
  skin: ["default", { option: true }],

  context: async ({ skin }, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
    });
    await routeAo3Fixtures(context, skin);
    await use(context);
    await context.close();
  },

  serviceWorker: async ({ context }, use) => {
    const [existing] = context.serviceWorkers();
    await use(existing ?? (await context.waitForEvent("serviceworker")));
  },
});

export { expect } from "@playwright/test";

/** Serve captured AO3 pages + skins offline; every other request is blocked. */
async function routeAo3Fixtures(context: BrowserContext, skin: Skin): Promise<void> {
  await context.route(/^https?:\/\//, async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== AO3_ORIGIN) return route.abort();

    const pageFile = PAGE_FILES[url.pathname];
    if (pageFile) {
      const skinStylesheet = SKIN_STYLESHEETS[skin];
      let html = fixture("pages", pageFile);
      if (skinStylesheet) {
        html = html.replace("</head>", `<link rel="stylesheet" href="${skinStylesheet}"></head>`);
      }
      return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    }

    if (url.pathname === DEFAULT_SKIN_STYLESHEET) {
      return route.fulfill({ contentType: "text/css", body: fixture("skins", "ao3-default.css") });
    }
    if (url.pathname === SKIN_STYLESHEETS.reversi) {
      return route.fulfill({ contentType: "text/css", body: fixture("skins", "reversi.css") });
    }
    if (url.pathname.endsWith(".css")) return route.fulfill({ contentType: "text/css", body: "" });
    return route.fulfill({ status: 404, body: "" });
  });
}

export type RuleSeed = Pick<Rule, "pattern" | "action" | "category" | "matchMode">;

export async function seedRules(serviceWorker: Worker, seeds: readonly RuleSeed[]): Promise<void> {
  const rules: Rule[] = seeds.map((seed, index) => ({
    ...seed,
    id: `e2e-${index}`,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    source: "manual",
  }));
  await serviceWorker.evaluate(async (value) => {
    await chrome.storage.local.set({ ao3th_rules: value });
  }, rules);
}

/** Navigate and wait until the content script has rendered (hover host mounts last). */
export async function openAo3(page: Page, path: string): Promise<void> {
  await page.goto(AO3_ORIGIN + path);
  await page.locator("#ao3th-hover-host").waitFor({ state: "attached" });
}
