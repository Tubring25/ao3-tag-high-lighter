import type { HitStats } from "../shared/message";
import type { Settings } from "../core/types";
import { renderPopupApp, type PopupAppDeps } from "./popupApp";

describe("renderPopupApp", () => {
  it("renders the global toggle from settings", async () => {
    const container = document.createElement("div");

    await renderPopupApp(container, createDeps({ getSettings: vi.fn(async () => createSettings({ extensionEnabled: false })) }));

    expect(container.querySelector<HTMLInputElement>("[data-popup-toggle]")?.checked).toBe(false);
    expect(container.querySelector("[data-popup-global-status]")?.textContent).toBe("Paused");
  });

  it("saves settings and shows feedback when the global toggle changes", async () => {
    const container = document.createElement("div");
    const saveSettings = vi.fn(async (patch: Partial<Settings>) => createSettings(patch));

    await renderPopupApp(container, createDeps({ saveSettings }));
    const toggle = container.querySelector<HTMLInputElement>("[data-popup-toggle]");
    if (!toggle) throw new Error("Toggle was not rendered");

    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    expect(container.querySelector("[data-popup-global-save-status]")?.textContent).toBe("Saving...");
    await flushAsyncHandlers();

    expect(saveSettings).toHaveBeenCalledWith({ extensionEnabled: false });
    expect(container.querySelector("[data-popup-global-status]")?.textContent).toBe("Paused");
    expect(container.querySelector("[data-popup-global-save-status]")?.textContent).toBe("");
    expect(container.textContent).toContain("Extension paused");
    expect(container.querySelector("[data-popup-notice]")?.getAttribute("data-notice")).toBe("paused");
    expect(toggle.disabled).toBe(false);
  });

  it("reverts the global toggle and reports save failure", async () => {
    const container = document.createElement("div");
    const logError = vi.fn();
    const saveSettings = vi.fn(async () => {
      throw new Error("storage failed");
    });

    await renderPopupApp(container, createDeps({ logError, saveSettings }));
    const toggle = container.querySelector<HTMLInputElement>("[data-popup-toggle]");
    if (!toggle) throw new Error("Toggle was not rendered");

    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    await flushAsyncHandlers();

    expect(toggle.checked).toBe(true);
    expect(container.querySelector("[data-popup-global-status]")?.textContent).toBe("On");
    expect(container.querySelector("[data-popup-global-save-status]")?.textContent).toBe("Could not save. Try again.");
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("renders stats returned from the active tab", async () => {
    const container = document.createElement("div");

    await renderPopupApp(
      container,
      createDeps({
        sendMessageToTab: vi.fn(async () => createHitStats({ highlight: 2, warn: 1, hideWork: 1, totalRules: 7 })),
      })
    );

    expect(container.textContent).toContain("4 tag matches on this page");
    expect(container.textContent).toContain("Highlight2");
    expect(container.textContent).toContain("Warn1");
    expect(container.textContent).toContain("Collapsed works1");
    expect(container.textContent).not.toContain("Local only");
    expect(container.textContent).not.toContain("MVP");
  });

  it("renders a distinct zero-match state", async () => {
    const container = document.createElement("div");

    await renderPopupApp(
      container,
      createDeps({
        sendMessageToTab: vi.fn(async () => createHitStats({ highlight: 0, warn: 0, hideWork: 0, totalRules: 7 })),
      })
    );

    expect(container.textContent).toContain("No rule matches on this page yet");
    expect(container.querySelector(".popup-notice")?.getAttribute("data-notice")).toBe("empty");
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

  it("toggles the hover button setting from a labeled switch", async () => {
    const container = document.createElement("div");
    const saveSettings = vi.fn(async (patch: Partial<Settings>) => createSettings(patch));

    await renderPopupApp(container, createDeps({ saveSettings }));
    const toggle = container.querySelector<HTMLInputElement>("[data-popup-hover-toggle]");
    if (!toggle) throw new Error("Hover button toggle was not rendered");

    expect(container.textContent).toContain("Tag hover quick-add");
    expect(container.textContent).toContain("Show the + button next to AO3 tags.");
    expect(container.querySelector("[data-popup-hover-status]")?.textContent).toBe("On");
    expect(toggle.checked).toBe(true);

    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    await flushAsyncHandlers();

    expect(saveSettings).toHaveBeenCalledWith({ hoverButtonEnabled: false });
    expect(container.querySelector("[data-popup-hover-status]")?.textContent).toBe("Off");
    expect(container.querySelector("[data-popup-hover-save-status]")?.textContent).toBe("");
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
