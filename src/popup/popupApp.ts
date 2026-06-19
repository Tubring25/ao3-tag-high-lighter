import type { Settings } from "../core/types";
import { DEFAULT_ACTION_STYLES } from "../core/actionStyles";
import { LOG_PREFIX } from "../shared/constants";
import { applyDocumentLanguage, getLocalizedActionLabel, setLanguagePreference, t } from "../shared/i18n";
import type { HitStats, RuntimeMessage } from "../shared/message";
import {
  getSettings as defaultGetSettings,
  saveSettings as defaultSaveSettings,
} from "../storage/settingsStorage";

export interface PopupAppDeps {
  getSettings(): Promise<Settings>;
  saveSettings(patch: Partial<Settings>): Promise<Settings>;
  getCurrentTab(): Promise<CurrentTab | null>;
  sendMessageToTab(tabId: number, message: RuntimeMessage): Promise<unknown>;
  openOptionsPage(): void;
  logError(error: unknown): void;
}

export interface CurrentTab {
  id?: number;
  url?: string;
}

interface ChromeLike {
  tabs?: {
    query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<CurrentTab[]>;
    sendMessage(tabId: number, message: RuntimeMessage): Promise<unknown>;
  };
  runtime?: {
    openOptionsPage(): void;
  };
}

const EMPTY_STATS: HitStats = {
  highlight: 0,
  warn: 0,
  hideWork: 0,
  totalRules: 0,
};

type ToggleSettingKey = "extensionEnabled" | "hoverButtonEnabled";

export async function renderPopupApp(
  container: HTMLElement,
  deps: PopupAppDeps = createRealDeps()
): Promise<void> {
  container.textContent = "";
  container.appendChild(createShell());

  const shell = container.querySelector<HTMLElement>("[data-popup-shell]");
  if (!shell) return;

  const currentTab = await getCurrentTabSafely(deps);
  let settings: Settings;

  try {
    settings = await deps.getSettings();
    setLanguagePreference(settings.languagePreference);
    applyDocumentLanguage();
  } catch (error) {
    deps.logError(error);
    settings = createFallbackSettings();
    setLanguagePreference(settings.languagePreference);
    applyDocumentLanguage();
    const pageLabel = getPageLabel(currentTab);
    renderHeader(shell, settings, null, deps, pageLabel);
    renderErrorNotice(shell);
    renderActions(shell, settings, deps);
    return;
  }

  const pageLabel = getPageLabel(currentTab);
  const stats = await getCurrentPageStats(deps, currentTab);

  renderHeader(shell, settings, stats, deps, pageLabel);
  renderPageStatus(shell, settings, stats);
  renderStats(shell, stats, !settings.extensionEnabled, settings);
  renderActions(shell, settings, deps);
}

async function getCurrentTabSafely(deps: PopupAppDeps): Promise<CurrentTab | null> {
  try {
    return await deps.getCurrentTab();
  } catch (error) {
    deps.logError(error);
    return null;
  }
}

async function getCurrentPageStats(
  deps: PopupAppDeps,
  currentTab: CurrentTab | null
): Promise<HitStats | null> {
  if (currentTab?.id == null) return null;

  try {
    const response = await deps.sendMessageToTab(currentTab.id, { type: "GET_HIT_STATS" });
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

function renderHeader(
  container: HTMLElement,
  settings: Settings,
  stats: HitStats | null,
  deps: PopupAppDeps,
  pageLabelText: string
): void {
  const header = document.createElement("header");
  header.className = "popup-header";

  const brand = document.createElement("div");
  brand.className = "popup-brand";

  const title = document.createElement("h1");
  title.className = "popup-title";
  title.textContent = t("extensionName");

  const pageLabel = document.createElement("p");
  pageLabel.className = "popup-page-label";
  pageLabel.textContent = pageLabelText;

  brand.append(title, pageLabel);

  const control = document.createElement("div");
  control.className = "popup-header-control";

  const switchLabel = document.createElement("label");
  switchLabel.className = "popup-switch";
  switchLabel.setAttribute("aria-label", t("popupExtensionEnabledAria"));

  const status = document.createElement("span");
  status.className = "popup-switch-state";
  status.dataset.popupGlobalStatus = "true";
  status.textContent = getExtensionStateLabel(settings.extensionEnabled);

  const saveStatus = document.createElement("span");
  saveStatus.className = "popup-save-status";
  saveStatus.dataset.popupGlobalSaveStatus = "true";
  saveStatus.setAttribute("aria-live", "polite");

  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = settings.extensionEnabled;
  toggle.dataset.popupToggle = "true";
  toggle.setAttribute("aria-label", t("popupExtensionEnabledAria"));
  attachSettingToggle(toggle, "extensionEnabled", status, saveStatus, deps, getExtensionStateLabel, {
    onSaveSuccess: (enabled) => {
      const notice = container.querySelector<HTMLElement>("[data-popup-notice]");
      if (notice) applyPageStatus(notice, enabled, stats);
      const statsSection = container.querySelector<HTMLElement>(".popup-stats");
      if (statsSection) {
        if (enabled) {
          delete statsSection.dataset.state;
        } else {
          statsSection.dataset.state = "paused";
        }
      }
      syncPausedControls(container, enabled);
    },
  });

  const switchTrack = document.createElement("span");
  switchTrack.className = "popup-switch-track";

  const switchKnob = document.createElement("span");
  switchKnob.className = "popup-switch-knob";

  switchTrack.appendChild(switchKnob);
  switchLabel.append(toggle, switchTrack);
  control.append(switchLabel, status, saveStatus);
  header.append(brand, control);
  container.appendChild(header);
}

function renderPageStatus(
  container: HTMLElement,
  settings: Settings,
  stats: HitStats | null
): void {
  const notice = document.createElement("section");
  notice.className = "popup-notice";
  notice.dataset.popupNotice = "true";

  const title = document.createElement("h2");
  title.className = "popup-notice-title";

  const body = document.createElement("p");
  body.className = "popup-notice-body";

  notice.append(title, body);
  applyPageStatus(notice, settings.extensionEnabled, stats);
  container.appendChild(notice);
}

function renderErrorNotice(container: HTMLElement): void {
  const notice = document.createElement("section");
  notice.className = "popup-notice";
  notice.dataset.popupNotice = "true";
  notice.dataset.notice = "error";

  const title = document.createElement("h2");
  title.className = "popup-notice-title";
  title.textContent = t("popupSettingsLoadErrorTitle");

  const body = document.createElement("p");
  body.className = "popup-notice-body";
  body.textContent = t("popupSettingsLoadErrorBody");

  notice.append(title, body);
  container.appendChild(notice);
}

function applyPageStatus(notice: HTMLElement, extensionEnabled: boolean, stats: HitStats | null): void {
  const title = notice.querySelector<HTMLElement>(".popup-notice-title");
  const body = notice.querySelector<HTMLElement>(".popup-notice-body");
  if (!title || !body) return;

  if (!stats) {
    notice.dataset.notice = "unavailable";
    title.textContent = t("popupOpenAo3PageTitle");
    body.textContent = t("popupOpenAo3PageBody");
  } else if (!extensionEnabled) {
    notice.dataset.notice = "paused";
    title.textContent = t("popupPausedTitle");
    body.textContent =
      getVisibleMatchCount(stats) > 0
        ? t("popupPausedMatchesBody")
        : t("popupPausedEmptyBody");
  } else if (getVisibleMatchCount(stats) === 0) {
    notice.dataset.notice = "empty";
    title.textContent = t("popupNoMatchesTitle");
    body.textContent = t("popupNoMatchesBody");
  } else {
    notice.dataset.notice = "active";
    title.textContent = t("popupMatchesTitle", [getVisibleMatchCount(stats)]);
    body.textContent = t("popupStylesActiveBody");
  }
}

function renderStats(
  container: HTMLElement,
  stats: HitStats | null,
  paused: boolean,
  settings: Settings
): void {
  if (!stats) return;

  const section = document.createElement("section");
  section.className = "popup-stats";
  if (paused) section.dataset.state = "paused";

  const rows: Array<[string, string, number]> = [
    [t("popupStatHighlightTags", [getLocalizedActionLabel("highlight", settings.actionStyles)]), "highlight", stats.highlight],
    [getLocalizedActionLabel("warn", settings.actionStyles), "warn", stats.warn],
    [t("popupStatCollapseWork"), "hideWork", stats.hideWork],
  ];

  for (const [label, key, count] of rows) {
    const row = document.createElement("div");
    row.className = "popup-stat-row";
    row.dataset.stat = key;
    row.append(createStatLabel(label), createStatValue(count));
    section.appendChild(row);
  }

  container.appendChild(section);
}

function renderActions(container: HTMLElement, settings: Settings, deps: PopupAppDeps): void {
  const actions = document.createElement("section");
  actions.className = "popup-actions";

  const manageButton = document.createElement("button");
  manageButton.type = "button";
  manageButton.className = "popup-button popup-button-primary";
  manageButton.dataset.popupOptions = "true";
  if (!settings.extensionEnabled) manageButton.dataset.state = "paused";
  manageButton.textContent = t("popupManageRules");
  manageButton.addEventListener("click", () => {
    deps.openOptionsPage();
  });

  const hoverSetting = createHoverButtonSetting(settings, deps);

  actions.append(manageButton, hoverSetting);
  container.appendChild(actions);
}

function createHoverButtonSetting(settings: Settings, deps: PopupAppDeps): HTMLElement {
  const wrapper = document.createElement("label");
  wrapper.className = "popup-setting-row";

  const copy = document.createElement("span");
  copy.className = "popup-setting-copy";

  const title = document.createElement("span");
  title.className = "popup-setting-title";
  title.textContent = t("popupTagHoverQuickAdd");

  const description = document.createElement("span");
  description.className = "popup-setting-description";
  description.textContent = t("popupTagHoverQuickAddDescription");

  const statusRow = document.createElement("span");
  statusRow.className = "popup-setting-status-row";

  const status = document.createElement("span");
  status.className = "popup-setting-status";
  status.dataset.popupHoverStatus = "true";
  status.textContent = getOnOffLabel(settings.extensionEnabled && settings.hoverButtonEnabled);

  const saveStatus = document.createElement("span");
  saveStatus.className = "popup-save-status";
  saveStatus.dataset.popupHoverSaveStatus = "true";
  saveStatus.setAttribute("aria-live", "polite");

  statusRow.append(status, saveStatus);
  copy.append(title, description, statusRow);

  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = settings.extensionEnabled && settings.hoverButtonEnabled;
  toggle.disabled = !settings.extensionEnabled;
  toggle.dataset.popupHoverToggle = "true";
  toggle.dataset.popupPreferredChecked = String(settings.hoverButtonEnabled);
  toggle.setAttribute("aria-label", t("popupTagHoverQuickAddEnabledAria"));
  attachSettingToggle(toggle, "hoverButtonEnabled", status, saveStatus, deps, getOnOffLabel, {
    onSaveSuccess: (enabled) => {
      toggle.dataset.popupPreferredChecked = String(enabled);
    },
  });

  const switchTrack = document.createElement("span");
  switchTrack.className = "popup-switch-track";

  const switchKnob = document.createElement("span");
  switchKnob.className = "popup-switch-knob";

  switchTrack.appendChild(switchKnob);
  wrapper.append(copy, toggle, switchTrack);
  return wrapper;
}

function attachSettingToggle(
  toggle: HTMLInputElement,
  settingKey: ToggleSettingKey,
  stateElement: HTMLElement,
  saveStatusElement: HTMLElement,
  deps: PopupAppDeps,
  getStateLabel: (enabled: boolean) => string,
  options: { onSaveSuccess?: (enabled: boolean) => void } = {}
): void {
  toggle.addEventListener("change", () => {
    void saveToggleSetting(
      toggle,
      settingKey,
      stateElement,
      saveStatusElement,
      deps,
      getStateLabel,
      options
    );
  });
}

async function saveToggleSetting(
  toggle: HTMLInputElement,
  settingKey: ToggleSettingKey,
  stateElement: HTMLElement,
  saveStatusElement: HTMLElement,
  deps: PopupAppDeps,
  getStateLabel: (enabled: boolean) => string,
  options: { onSaveSuccess?: (enabled: boolean) => void } = {}
): Promise<void> {
  const previousChecked = !toggle.checked;
  const nextChecked = toggle.checked;

  toggle.disabled = true;
  stateElement.textContent = getStateLabel(nextChecked);
  clearSaveStatus(saveStatusElement);

  try {
    const patch: Partial<Settings> = { [settingKey]: nextChecked };
    await deps.saveSettings(patch);
    stateElement.textContent = getStateLabel(nextChecked);
    clearSaveStatus(saveStatusElement);
    options.onSaveSuccess?.(nextChecked);
  } catch (error) {
    toggle.checked = previousChecked;
    stateElement.textContent = getStateLabel(previousChecked);
    setSaveStatus(saveStatusElement, t("popupSaveError"), "error");
    deps.logError(error);
  } finally {
    toggle.disabled = false;
  }
}

function setSaveStatus(element: HTMLElement, text: string, status: "error"): void {
  element.textContent = text;
  element.dataset.status = status;
}

function clearSaveStatus(element: HTMLElement): void {
  element.textContent = "";
  delete element.dataset.status;
}

function getExtensionStateLabel(enabled: boolean): string {
  return enabled ? t("labelOn") : t("labelPaused");
}

function getOnOffLabel(enabled: boolean): string {
  return enabled ? t("labelOn") : t("labelOff");
}

function createStatLabel(label: string): HTMLElement {
  const element = document.createElement("span");
  element.className = "popup-stat-label";
  element.textContent = label;
  return element;
}

function createStatValue(count: number): HTMLElement {
  const element = document.createElement("strong");
  element.className = "popup-stat-value";
  element.textContent = String(count);
  return element;
}

function getVisibleMatchCount(stats: HitStats): number {
  return stats.highlight + stats.warn + stats.hideWork;
}

function syncPausedControls(container: HTMLElement, extensionEnabled: boolean): void {
  const manageButton = container.querySelector<HTMLElement>("[data-popup-options]");
  if (manageButton) {
    if (extensionEnabled) {
      delete manageButton.dataset.state;
    } else {
      manageButton.dataset.state = "paused";
    }
  }

  const hoverToggle = container.querySelector<HTMLInputElement>("[data-popup-hover-toggle]");
  const hoverStatus = container.querySelector<HTMLElement>("[data-popup-hover-status]");
  if (!hoverToggle) return;

  const preferredChecked = hoverToggle.dataset.popupPreferredChecked === "true";
  if (extensionEnabled) {
    hoverToggle.disabled = false;
    hoverToggle.checked = preferredChecked;
    if (hoverStatus) hoverStatus.textContent = getOnOffLabel(preferredChecked);
    return;
  }

  hoverToggle.checked = false;
  hoverToggle.disabled = true;
  if (hoverStatus) hoverStatus.textContent = getOnOffLabel(false);
}

function getPageLabel(tab: CurrentTab | null): string {
  if (!tab?.url) return t("popupCurrentTab");

  try {
    const url = new URL(tab.url);
    if (url.hostname === "archiveofourown.org") {
      return /^\/works\/\d+(?:\/|$)/.test(url.pathname) ? t("popupAo3WorkPage") : t("popupAo3Page");
    }
    return url.hostname;
  } catch {
    return t("popupCurrentTab");
  }
}

function createFallbackSettings(): Settings {
  return {
    extensionEnabled: false,
    hoverButtonEnabled: true,
    showToast: true,
    hideWorkMode: "collapse",
    enableOnWorkDetailPage: true,
    languagePreference: "auto",
    actionStyles: DEFAULT_ACTION_STYLES,
  };
}

function createRealDeps(): PopupAppDeps {
  return {
    getSettings: defaultGetSettings,
    saveSettings: defaultSaveSettings,
    getCurrentTab: async () => {
      const tabsApi = getChrome().tabs;
      if (!tabsApi) return null;
      const [tab] = await tabsApi.query({ active: true, currentWindow: true });
      return tab ?? null;
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
      console.error(`${LOG_PREFIX} Popup error:`, error);
    },
  };
}

function isHitStats(value: unknown): value is HitStats {
  if (!isObjectRecord(value)) return false;
  return (
    typeof value.highlight === "number" &&
    typeof value.warn === "number" &&
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
