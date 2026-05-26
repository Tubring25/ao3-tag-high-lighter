import type { Settings } from "../core/types";
import type { HitStats, RuntimeMessage } from "../shared/message";
import {
  getSettings as defaultGetSettings,
  saveSettings as defaultSaveSettings,
} from "../storage/settingsStorage";

export interface PopupAppDeps {
  getSettings(): Promise<Settings>;
  saveSettings(patch: Partial<Settings>): Promise<Settings>;
  getCurrentTabId(): Promise<number | null>;
  sendMessageToTab(tabId: number, message: RuntimeMessage): Promise<unknown>;
  openOptionsPage(): void;
  logError(error: unknown): void;
}

interface ChromeLike {
  tabs?: {
    query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<Array<{ id?: number }>>;
    sendMessage(tabId: number, message: RuntimeMessage): Promise<unknown>;
  };
  runtime?: {
    openOptionsPage(): void;
  };
}

const EMPTY_STATS: HitStats = {
  highlight: 0,
  warn: 0,
  mute: 0,
  hideWork: 0,
  totalRules: 0,
};

export async function renderPopupApp(
  container: HTMLElement,
  deps: PopupAppDeps = createRealDeps()
): Promise<void> {
  container.textContent = "";
  container.appendChild(createShell());

  const shell = container.querySelector<HTMLElement>("[data-popup-shell]");
  if (!shell) return;

  const settings = await deps.getSettings();
  const stats = await getCurrentPageStats(deps);

  renderHeader(shell);
  renderToggle(shell, settings, deps);
  renderStats(shell, stats);
  renderOptionsButton(shell, deps);
}

async function getCurrentPageStats(deps: PopupAppDeps): Promise<HitStats | null> {
  const tabId = await deps.getCurrentTabId();
  if (tabId == null) return null;

  try {
    const response = await deps.sendMessageToTab(tabId, { type: "GET_HIT_STATS" });
    return isHitStats(response) ? response : null;
  } catch {
    return null;
  }
}

function createShell(): HTMLElement {
  const shell = document.createElement("main");
  shell.className = "popup-shell";
  shell.dataset.popupShell = "true";
  return shell;
}

function renderHeader(container: HTMLElement): void {
  const title = document.createElement("h1");
  title.className = "popup-title";
  title.textContent = "AO3 Tag Highlighter";
  container.appendChild(title);
}

function renderToggle(container: HTMLElement, settings: Settings, deps: PopupAppDeps): void {
  const wrapper = document.createElement("label");
  wrapper.className = "popup-toggle";

  const label = document.createElement("span");
  label.textContent = "Extension enabled";

  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = settings.extensionEnabled;
  toggle.dataset.popupToggle = "true";
  toggle.addEventListener("change", () => {
    void deps.saveSettings({ extensionEnabled: toggle.checked }).catch(deps.logError);
  });

  wrapper.append(label, toggle);
  container.appendChild(wrapper);
}

function renderStats(container: HTMLElement, stats: HitStats | null): void {
  const section = document.createElement("section");
  section.className = "popup-stats";

  const heading = document.createElement("h2");
  heading.textContent = "Current page";
  section.appendChild(heading);

  if (!stats) {
    const fallback = document.createElement("p");
    fallback.className = "popup-empty";
    fallback.textContent = "No AO3 page stats available.";
    section.appendChild(fallback);
    container.appendChild(section);
    return;
  }

  const rows: Array<[string, string, number, string]> = [
    ["Highlight", "highlight", stats.highlight, "tags"],
    ["Warn", "warn", stats.warn, "works"],
    ["Mute", "mute", stats.mute, "tags"],
    ["Hide work", "hideWork", stats.hideWork, "works"],
    ["Rules", "rules", stats.totalRules, "rules"],
  ];

  for (const [label, key, count, unit] of rows) {
    const row = document.createElement("div");
    row.className = "popup-stat-row";
    row.dataset.stat = key;
    row.textContent = `${label}: ${count} ${unit}`;
    section.appendChild(row);
  }

  container.appendChild(section);
}

function renderOptionsButton(container: HTMLElement, deps: PopupAppDeps): void {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "popup-options-button";
  button.dataset.popupOptions = "true";
  button.textContent = "Manage rules";
  button.addEventListener("click", () => {
    deps.openOptionsPage();
  });
  container.appendChild(button);
}

function createRealDeps(): PopupAppDeps {
  return {
    getSettings: defaultGetSettings,
    saveSettings: defaultSaveSettings,
    getCurrentTabId: async () => {
      const tabsApi = getChrome().tabs;
      if (!tabsApi) return null;
      const [tab] = await tabsApi.query({ active: true, currentWindow: true });
      return tab?.id ?? null;
    },
    sendMessageToTab: async (tabId, message) => {
      const tabsApi = getChrome().tabs;
      if (!tabsApi) {
        throw new Error("Chrome tabs API is unavailable");
      }
      return tabsApi.sendMessage(tabId, message);
    },
    openOptionsPage: () => {
      getChrome().runtime?.openOptionsPage();
    },
    logError: (error) => {
      console.error("[AO3 Tag Highlighter] Popup error:", error);
    },
  };
}

function isHitStats(value: unknown): value is HitStats {
  if (!isObjectRecord(value)) return false;
  return (
    typeof value.highlight === "number" &&
    typeof value.warn === "number" &&
    typeof value.mute === "number" &&
    typeof value.hideWork === "number" &&
    typeof value.totalRules === "number"
  );
}

function getChrome(): ChromeLike {
  const chromeApi = (globalThis as typeof globalThis & { chrome?: ChromeLike }).chrome;
  if (!chromeApi) {
    throw new Error("Chrome extension API is unavailable");
  }
  return chromeApi;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createEmptyStats(): HitStats {
  return { ...EMPTY_STATS };
}
