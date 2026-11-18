// Guards against BUG-003: AO3 skins style every <button> with a fixed one-line
// height and nowrap, so long collapse reasons spilled out of the placeholder.
// Reasons must stay inside the bar, clamp to two lines, and never cover the action.
import type { Page } from "@playwright/test";
import { AO3_PAGES, expect, openAo3, seedRules, SKINS, test } from "./support/extension";

const COLLAPSED_PLACEHOLDER =
  'li.work.blurb[data-ao3th-hidden="collapse"]:not([data-ao3th-expanded]) > .ao3th-collapse-placeholder';

interface PlaceholderLayout {
  lines: number;
  clipped: boolean;
  messageInsideBar: boolean;
  barInsideWork: boolean;
  overlapsAction: boolean;
}

function measureCollapsedPlaceholders(page: Page): Promise<PlaceholderLayout[]> {
  return page.locator(COLLAPSED_PLACEHOLDER).evaluateAll((bars) =>
    bars.map((bar) => {
      const message = bar.querySelector(".ao3th-collapse-message") as HTMLElement;
      const action = bar.querySelector(".ao3th-collapse-action") as HTMLElement;
      const work = bar.parentElement as HTMLElement;
      const barBox = bar.getBoundingClientRect();
      const messageBox = message.getBoundingClientRect();
      const actionBox = action.getBoundingClientRect();
      const workBox = work.getBoundingClientRect();
      const lineHeight = parseFloat(getComputedStyle(message).lineHeight);
      const tolerance = 0.5;
      return {
        lines: Math.round(messageBox.height / lineHeight),
        clipped: message.scrollHeight > message.clientHeight + 1,
        messageInsideBar:
          messageBox.left >= barBox.left - tolerance &&
          messageBox.right <= barBox.right + tolerance &&
          messageBox.top >= barBox.top - tolerance &&
          messageBox.bottom <= barBox.bottom + tolerance,
        barInsideWork: barBox.right <= workBox.right + tolerance,
        overlapsAction: messageBox.right > actionBox.left + tolerance,
      };
    })
  );
}

function expectContained(layouts: readonly PlaceholderLayout[]): void {
  for (const [index, layout] of layouts.entries()) {
    expect.soft(layout.messageInsideBar, `placeholder ${index}: reasons stay inside the bar`).toBe(true);
    expect.soft(layout.barInsideWork, `placeholder ${index}: bar stays inside the work`).toBe(true);
    expect.soft(layout.overlapsAction, `placeholder ${index}: reasons do not cover the action`).toBe(false);
  }
}

for (const skin of SKINS) {
  test.describe(`${skin} skin: collapse placeholder`, () => {
    test.use({ skin });

    test("many reasons clamp to two lines with an ellipsis", async ({ page, serviceWorker }) => {
      // Every freeform tag matches, so each work collapses with a long reason list.
      await seedRules(serviceWorker, [{ pattern: "*", action: "hideWork", category: "freeform", matchMode: "wildcard" }]);
      await openAo3(page, AO3_PAGES.tagWorks);

      const layouts = await measureCollapsedPlaceholders(page);
      expect(layouts.length).toBeGreaterThan(0);
      expect(layouts.every((layout) => layout.lines <= 2), `line counts: ${layouts.map((l) => l.lines)}`).toBe(true);
      // The fixture must actually exercise the clamp, otherwise this test proves nothing.
      expect(layouts.filter((layout) => layout.clipped).length).toBeGreaterThan(0);
      expectContained(layouts);
    });

    test("a single reason stays on one line", async ({ page, serviceWorker }) => {
      await seedRules(serviceWorker, [
        { pattern: "Peter Pettigrew", action: "hideWork", category: "character", matchMode: "exact" },
      ]);
      await openAo3(page, AO3_PAGES.tagWorks);

      const layouts = await measureCollapsedPlaceholders(page);
      expect(layouts.length).toBeGreaterThan(0);
      expect(layouts.map((layout) => layout.lines)).toEqual(layouts.map(() => 1));
      expect(layouts.filter((layout) => layout.clipped)).toEqual([]);
      expectContained(layouts);
    });
  });
}
