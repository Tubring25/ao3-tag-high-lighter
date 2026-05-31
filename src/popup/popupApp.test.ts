import type { HitStats } from "../shared/message";
import type { Settings } from "../core/types";
import { renderPopupApp, type PopupAppDeps } from "./popupApp";

describe("renderPopupApp", () => {
  it("renders the global toggle from settings", async () => {
    const container = document.createElement("div");

    await renderPopupApp(container, createDeps({ getSettings: vi.fn(async () => createSettings({ extensionEnabled: false })) }));

    expect(container.querySelector<HTMLInputElement>("[data-popup-toggle]")?.checked).toBe(false);
  });

  it("saves settings when the global toggle changes", async () => {
    const container = document.createElement("div");
    const saveSettings = vi.fn(async (patch: Partial<Settings>) => createSettings(patch));

    await renderPopupApp(container, createDeps({ saveSettings }));
    const toggle = container.querySelector<HTMLInputElement>("[data-popup-toggle]");
    if (!toggle) throw new Error("Toggle was not rendered");

    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    await flushAsyncHandlers();

    expect(saveSettings).toHaveBeenCalledWith({ extensionEnabled: false });
  });

  it("renders stats returned from the active tab", async () => {
    const container = document.createElement("div");

    await renderPopupApp(
      container,
      createDeps({
        sendMessageToTab: vi.fn(async () => createHitStats({ highlight: 2, warn: 1, hideWork: 1, totalRules: 7 })),
      })
    );

    expect(container.textContent).toContain("2 tags");
    expect(container.textContent).toContain("1 works");
    expect(container.textContent).toContain("7 rules");
  });

  it("shows a fallback when there is no active tab", async () => {
    const container = document.createElement("div");

    await renderPopupApp(container, createDeps({ getCurrentTabId: vi.fn(async () => null) }));

    expect(container.textContent).toContain("No AO3 page stats available");
  });

  it("shows a fallback when content script stats are unavailable", async () => {
    const container = document.createElement("div");

    await renderPopupApp(
      container,
      createDeps({
        sendMessageToTab: vi.fn(async () => {
          throw new Error("No receiving end");
        }),
      })
    );

    expect(container.textContent).toContain("No AO3 page stats available");
  });

  it("opens the options page from the manage button", async () => {
    const container = document.createElement("div");
    const openOptionsPage = vi.fn();

    await renderPopupApp(container, createDeps({ openOptionsPage }));
    container.querySelector<HTMLButtonElement>("[data-popup-options]")?.click();

    expect(openOptionsPage).toHaveBeenCalledTimes(1);
  });
});

function createDeps(overrides: Partial<PopupAppDeps> = {}): PopupAppDeps {
  return {
    getSettings: vi.fn(async () => createSettings()),
    saveSettings: vi.fn(async (patch) => createSettings(patch)),
    getCurrentTabId: vi.fn(async () => 12),
    sendMessageToTab: vi.fn(async () => createHitStats()),
    openOptionsPage: vi.fn(),
    logError: vi.fn(),
    ...overrides,
  };
}

function createSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    extensionEnabled: true,
    hoverButtonEnabled: true,
    showToast: true,
    hideWorkMode: "collapse",
    enableOnWorkDetailPage: true,
    ...overrides,
  };
}

function createHitStats(overrides: Partial<HitStats> = {}): HitStats {
  return {
    highlight: 1,
    warn: 0,
    hideWork: 0,
    totalRules: 1,
    ...overrides,
  };
}

async function flushAsyncHandlers(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await Promise.resolve();
  }
}
