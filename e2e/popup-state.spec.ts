import type { Page, Worker } from "@playwright/test";
import { AO3_PAGES, expect, openAo3, seedRules, test } from "./support/extension";

const globalToggle = (page: Page) => page.locator("[data-popup-toggle]");
const quickAddToggle = (page: Page) => page.locator("[data-popup-hover-toggle]");

async function openPopup(popup: Page, currentPage: Page, worker: Worker): Promise<void> {
  const base = `chrome-extension://${new URL(worker.url()).host}`;
  await popup.goto(`${base}/popup.html`);
  // Loading popup.html in a tab activates that tab. Keep the AO3 tab active while
  // reloading the popup document, as it would be with the toolbar popup open.
  await currentPage.bringToFront();
  await popup.reload();
  await expect(popup.locator("[data-popup-global-status]")).not.toHaveText("");
}

for (const language of ["en", "zh_CN"] as const) {
  test.describe(`popup ${language}`, () => {
    test.beforeEach(async ({ serviceWorker }) => {
      await serviceWorker.evaluate(async (languagePreference) => {
        await chrome.storage.local.set({ ao3th_settings: { languagePreference } });
      }, language);
    });

    test("active and paused states stay compact and preserve quick-add preferences", async ({ page, context, serviceWorker }) => {
      await seedRules(serviceWorker, [{ pattern: "Texting", action: "highlight", category: "freeform", matchMode: "exact" }]);
      await openAo3(page, AO3_PAGES.tagWorks);
      const popup = await context.newPage();
      await openPopup(popup, page, serviceWorker);
      await expect(popup.locator("[data-popup-notice]")).toBeHidden();
      await expect(popup.locator('.popup-stat-row[data-stat="highlight"] strong')).not.toHaveText("0");
      await expect(quickAddToggle(popup)).toBeChecked();
      await expect(quickAddToggle(popup)).toBeEnabled();
      await expect(popup.locator(".popup-button-primary:visible")).toHaveCount(1);
      await popup.locator("[data-popup-shell]").screenshot({ path: test.info().outputPath("active.png") });

      // The inputs are visually hidden; Space on the focused input exercises the
      // real checkbox event and keeps focus on the same control across updates.
      await globalToggle(popup).focus();
      await popup.keyboard.press("Space");
      await expect(globalToggle(popup)).not.toBeChecked();
      await expect(globalToggle(popup)).toBeEnabled();
      await expect(globalToggle(popup)).toBeFocused();
      await expect(popup.locator("[data-popup-global-status]")).toHaveText(language === "en" ? "Global · Paused" : "全局 · 暂停");
      await expect(popup.locator("[data-popup-notice]")).toBeHidden();
      await expect(quickAddToggle(popup)).toBeDisabled();
      await expect(popup.locator("[data-popup-hover-status]")).toHaveText(language === "en" ? "Paused globally" : "随全局暂停");
      expect(await serviceWorker.evaluate(async () => {
        const stored = await chrome.storage.local.get("ao3th_settings");
        return (stored.ao3th_settings as { hoverButtonEnabled: boolean }).hoverButtonEnabled;
      })).toBe(true);
      await expect(page.locator('[data-ao3th-action="highlight"]')).toHaveCount(0);
      await popup.locator("[data-popup-shell]").screenshot({ path: test.info().outputPath("paused.png") });

      await popup.keyboard.press("Space");
      await expect(globalToggle(popup)).toBeChecked();
      await expect(quickAddToggle(popup)).toBeEnabled();
      await expect(quickAddToggle(popup)).toBeChecked();
      await expect(popup.locator("[data-popup-notice]")).toBeHidden();
      await quickAddToggle(popup).focus();
      await popup.keyboard.press("Space");
      await expect(quickAddToggle(popup)).not.toBeChecked();
      await expect(quickAddToggle(popup)).toBeEnabled();
      await expect(popup.locator("[data-popup-hover-status]")).toHaveText(language === "en" ? "Off" : "关闭");
      await globalToggle(popup).focus();
      await popup.keyboard.press("Space");
      await expect(globalToggle(popup)).toBeEnabled();
      await popup.keyboard.press("Space");
      await expect(quickAddToggle(popup)).toBeEnabled();
      await expect(quickAddToggle(popup)).not.toBeChecked();
      await expect(popup.locator(".popup-save-status")).toHaveText(["", ""]);
      for (const width of [390, 320]) {
        await popup.setViewportSize({ width, height: 700 });
        expect(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    });

    test("header keeps the same layout when the global state changes", async ({ page, context, serviceWorker }) => {
      await openAo3(page, AO3_PAGES.tagWorks);
      const popup = await context.newPage();
      await openPopup(popup, page, serviceWorker);
      await expect(popup.locator(".popup-page-label")).toHaveText(language === "en" ? "AO3 page" : "AO3 页面");

      const measureHeader = () => popup.evaluate(() => {
        const title = document.querySelector(".popup-title") as HTMLElement;
        const header = document.querySelector(".popup-header") as HTMLElement;
        const control = document.querySelector(".popup-header-control") as HTMLElement;
        const status = document.querySelector("[data-popup-global-status]") as HTMLElement;
        const lineHeight = parseFloat(getComputedStyle(title).lineHeight);
        const controlBox = control.getBoundingClientRect();
        return {
          titleLines: Math.round(title.getBoundingClientRect().height / lineHeight),
          headerHeight: header.getBoundingClientRect().height,
          controlLeft: controlBox.left,
          controlWidth: controlBox.width,
          statusFits: status.scrollWidth <= controlBox.width,
          noOverflow: document.documentElement.scrollWidth <= innerWidth,
        };
      });

      for (const width of [390, 320]) {
        await popup.setViewportSize({ width, height: 700 });
        await globalToggle(popup).focus();
        const on = await measureHeader();
        await popup.keyboard.press("Space");
        await expect(popup.locator("[data-popup-global-status]")).toHaveText(language === "en" ? "Global · Paused" : "全局 · 暂停");
        await expect(globalToggle(popup)).toBeEnabled();
        const paused = await measureHeader();
        await popup.locator("[data-popup-shell]").screenshot({ path: test.info().outputPath(`header-paused-${width}.png`) });
        await popup.keyboard.press("Space");
        await expect(globalToggle(popup)).toBeChecked();
        await expect(globalToggle(popup)).toBeEnabled();

        expect(paused).toEqual(on);
        expect(on.statusFits && on.noOverflow).toBe(true);
        if (width === 390) expect(on.titleLines).toBe(1);
        else expect(on.titleLines).toBeLessThanOrEqual(2);
      }
    });

    test("unadded websites have one notice, no permission shortcut, and survive pause", async ({ page, context, serviceWorker }) => {
      await context.route("https://unadded.example/**", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Website</title>" }));
      await page.goto("https://unadded.example/");
      const popup = await context.newPage();
      await openPopup(popup, page, serviceWorker);
      // Without a host grant or tabs/activeTab permission, Chrome omits the URL.
      // The popup must use a generic inactive-page hint in this case.
      await expect(popup.locator("[data-popup-notice]")).toHaveAttribute("data-notice", "unavailable");
      await expect(popup.locator(".popup-notice:visible")).toHaveCount(1);
      await expect(popup.locator("[data-popup-grant-access]")).toHaveCount(0);
      await expect(popup.locator(".popup-stats")).toBeHidden();
      await expect(popup.locator(".popup-page-label")).toHaveCount(0);
      await popup.locator("[data-popup-shell]").screenshot({ path: test.info().outputPath("unavailable.png") });
      await expect(quickAddToggle(popup)).toBeDisabled();
      await globalToggle(popup).focus();
      await popup.keyboard.press("Space");
      await expect(popup.locator("[data-popup-notice]")).toBeHidden();
      await expect(globalToggle(popup)).toBeEnabled();
      await popup.keyboard.press("Space");
      await expect(popup.locator("[data-popup-notice]")).toBeVisible();
      // Without a host grant or tabs/activeTab permission, Chrome omits the URL.
      // The popup must use a generic inactive-page hint in this case.
      await expect(popup.locator("[data-popup-notice]")).toHaveAttribute("data-notice", "unavailable");
      await expect(quickAddToggle(popup)).toBeDisabled();
    });
  });
}
