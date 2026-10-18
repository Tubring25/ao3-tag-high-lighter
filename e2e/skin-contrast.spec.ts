// Guards against BUG-002-style regressions: the extension must stay readable on
// every AO3 site skin. AO3 skins can ship their own contrast issues (Reversi's
// title links are 4.14:1), so page-wide checks only fail on color pairs the
// extension introduces; extension-owned elements must have no issues at all.
import type { Page, Worker } from "@playwright/test";
import {
  describeIssues,
  EXTENSION_OWNED_SELECTORS,
  findContrastIssues,
  newIssuesComparedTo,
  type ContrastIssue,
} from "./support/contrast";
import { AO3_PAGES, expect, openAo3, seedRules, SKINS, test, type RuleSeed } from "./support/extension";

const RULES: RuleSeed[] = [
  { pattern: "Sirius Black/Remus Lupin", action: "highlight", category: "relationship", matchMode: "exact" },
  { pattern: "Draco Malfoy", action: "highlight", category: "character", matchMode: "exact" },
  { pattern: "Severus Snape", action: "warn", category: "character", matchMode: "exact" },
  { pattern: "Peter Pettigrew", action: "hideWork", category: "character", matchMode: "exact" },
  { pattern: "Fluff", action: "warn", category: "freeform", matchMode: "exact" },
  { pattern: "Slight*", action: "hideWork", category: "freeform", matchMode: "wildcard" },
];

const PAGE_CONTENT = ["#main"];

async function skinBaseline(page: Page, serviceWorker: Worker, path: string): Promise<ContrastIssue[]> {
  await seedRules(serviceWorker, []);
  await openAo3(page, path);
  return findContrastIssues(page, PAGE_CONTENT);
}

async function expectNoNewIssues(page: Page, baseline: readonly ContrastIssue[]): Promise<void> {
  const introduced = newIssuesComparedTo(baseline, await findContrastIssues(page, PAGE_CONTENT));
  expect(describeIssues(introduced), "contrast failures introduced by the extension").toEqual([]);

  const owned = await findContrastIssues(page, EXTENSION_OWNED_SELECTORS);
  expect(describeIssues(owned), "contrast failures on extension-owned elements").toEqual([]);
}

for (const skin of SKINS) {
  test.describe(`${skin} skin`, () => {
    test.use({ skin });

    test("detects the page surface", async ({ page, serviceWorker }) => {
      await seedRules(serviceWorker, RULES);
      await openAo3(page, AO3_PAGES.tagWorks);

      const surface = await page.evaluate(() => document.documentElement.dataset.ao3thSurface ?? "light");
      expect(surface).toBe(skin === "reversi" ? "dark" : "light");
    });

    test("listing: matched works stay readable", async ({ page, serviceWorker }) => {
      const baseline = await skinBaseline(page, serviceWorker, AO3_PAGES.tagWorks);

      await seedRules(serviceWorker, RULES);
      await openAo3(page, AO3_PAGES.tagWorks);
      // Matches inside collapsed works are hidden, so assert on visible ones.
      for (const selector of ['[data-ao3th-action="highlight"]', ".ao3th-warn-banner", ".ao3th-collapse-placeholder"]) {
        await expect(page.locator(selector).filter({ visible: true }).first()).toBeVisible();
      }

      await expectNoNewIssues(page, baseline);
    });

    test("listing: expanded collapsed works stay readable", async ({ page, serviceWorker }) => {
      const baseline = await skinBaseline(page, serviceWorker, AO3_PAGES.tagWorks);

      await seedRules(serviceWorker, RULES);
      await openAo3(page, AO3_PAGES.tagWorks);
      const placeholders = page.locator(
        'li.work.blurb[data-ao3th-hidden="collapse"]:not([data-ao3th-expanded]) > .ao3th-collapse-placeholder'
      );
      const collapsedCount = await placeholders.count();
      expect(collapsedCount).toBeGreaterThan(0);
      while ((await placeholders.count()) > 0) await placeholders.first().click();
      await expect(page.locator('li.work.blurb[data-ao3th-expanded="true"]')).toHaveCount(collapsedCount);

      await expectNoNewIssues(page, baseline);
    });

    test("listing: tag hover, quick-add menu and toast stay readable", async ({ page, serviceWorker }) => {
      await seedRules(serviceWorker, RULES);
      await openAo3(page, AO3_PAGES.tagWorks);

      const tag = page.locator("li.work.blurb:not([data-ao3th-hidden]) li.freeforms a.tag:not([data-ao3th-action])").first();
      const tagText = (await tag.textContent())?.trim();
      await tag.hover();
      await expect(tag).toHaveAttribute("data-ao3th-hovered", "true");
      await page.locator("[data-ao3th-hover-button]").click();
      await expect(page.locator('[data-ao3th-menu-option][data-action="highlight"]')).toBeVisible();

      expect(describeIssues(await findContrastIssues(page, EXTENSION_OWNED_SELECTORS))).toEqual([]);

      await page.locator('[data-ao3th-menu-option][data-action="highlight"]').click();
      await expect(page.locator(".ao3th-toast")).toBeVisible();
      await expect(page.locator(`a.tag[data-ao3th-action="highlight"]`, { hasText: tagText ?? "" }).first()).toBeVisible();

      expect(describeIssues(await findContrastIssues(page, [".ao3th-toast-container"]))).toEqual([]);
    });

    test("work page: warning and collapse-match bars stay readable", async ({ page, serviceWorker }) => {
      const baseline = await skinBaseline(page, serviceWorker, AO3_PAGES.work);

      await seedRules(serviceWorker, RULES);
      await openAo3(page, AO3_PAGES.work);
      await expect(page.locator(".ao3th-detail-warning-bar")).toBeVisible();
      await expect(page.locator(".ao3th-detail-collapse-match-bar")).toBeVisible();

      await expectNoNewIssues(page, baseline);
    });
  });
}
