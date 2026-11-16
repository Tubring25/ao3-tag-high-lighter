import type { Settings } from "../core/types";
import { DEFAULT_ACTION_STYLES } from "../core/actionStyles";
import { AO3_ORIGIN_PATTERN, LOG_PREFIX } from "../shared/constants";
import { isAo3Host } from "../shared/customHosts";
import { getExtensionApi } from "../shared/extensionApi";
import { detectInputMode, type QuickAddInputMode } from "../shared/inputMode";
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
  closePopup(): void;
  hasSiteAccess(url: string): Promise<boolean>;
  requestAo3Access(): Promise<boolean>;
  reloadTab(tabId: number): Promise<void>;
  detectInputMode(): QuickAddInputMode;
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
    reload(tabId: number): Promise<void>;
  };
  runtime?: {
    openOptionsPage(): void;
  };
  permissions?: {
    contains(permissions: { origins: string[] }): Promise<boolean>;
    request(permissions: { origins: string[] }): Promise<boolean>;
  };
}

const EMPTY_STATS: HitStats = {
  highlight: 0,
  warn: 0,
  hideWork: 0,
  totalRules: 0,
};

type ToggleSettingKey = "extensionEnabled" | "hoverButtonEnabled";
type PageState = "active" | "access" | "unadded" | "refresh" | "unavailable" | "error";
interface ToggleCallbacks {
  onSaveStart?: () => void;
  onSaveSuccess?: (enabled: boolean) => void | Promise<void>;
  onSaveEnd?: () => void;
}

export async function renderPopupApp(
  container: HTMLElement,
  deps: PopupAppDeps = createRealDeps()
): Promise<void> {
  container.textContent = "";
  const shell = document.createElement("main");
  shell.className = "popup-shell";
  shell.dataset.popupShell = "true";
  container.appendChild(shell);

  const currentTab = await getCurrentTabSafely(deps);
  const inputMode = deps.detectInputMode();
  let settings: Settings;
  let settingsLoaded = true;
  try {
    settings = await deps.getSettings();
  } catch (error) {
    deps.logError(error);
    settings = createFallbackSettings();
    settingsLoaded = false;
  }
  setLanguagePreference(settings.languagePreference);
  applyDocumentLanguage();

  let stats = settingsLoaded ? await getCurrentPageStats(deps, currentTab) : null;
  let pageState: PageState = settingsLoaded ? await getPageState(deps, currentTab, stats) : "error";
  let globalSaving = false;
  let hoverSaving = false;

  const syncUi = (): void => {
    const enabled = settings.extensionEnabled;
    // The page state survives global pause; only its presentation is suppressed.
    notice.hidden = pageState !== "error" && (!enabled || pageState === "active");
    shell.dataset.pageState = pageState;
    shell.dataset.globalPaused = String(!enabled);
    statsSection.hidden = !stats;
    statsSection.dataset.state = enabled ? "active" : "paused";
    const hasNoticeAction = !notice.hidden && (pageState === "access" || pageState === "refresh");
    manageButton.classList.toggle("popup-button-primary", !hasNoticeAction);

    const running = enabled && pageState === "active";
    hoverToggle.checked = running && settings.hoverButtonEnabled;
    hoverToggle.disabled = !settingsLoaded || !running || globalSaving || hoverSaving;
    hoverSetting.dataset.dimmed = String(!running);
    hoverStatus.textContent = !enabled
      ? t("popupQuickAddGlobalPaused")
      : pageState !== "active"
        ? t("popupQuickAddSiteInactive")
        : getOnOffLabel(settings.hoverButtonEnabled);
    hoverDescription.hidden = !running;
    globalToggle.disabled = !settingsLoaded || globalSaving || hoverSaving;
  };

  const globalControl = renderHeader(shell, settings, getPageLabel(currentTab));
  const globalToggle = globalControl.toggle;
  const notice = document.createElement("section");
  notice.className = "popup-notice";
  notice.dataset.popupNotice = "true";
  notice.setAttribute("aria-live", "polite");
  shell.appendChild(notice);

  const updateNotice = (): void => {
    notice.textContent = "";
    notice.dataset.notice = pageState;
    delete notice.dataset.popupAccessNotice;
    if (pageState === "active") return;
    const title = document.createElement("h2");
    title.className = "popup-notice-title";
    const body = document.createElement("p");
    body.className = "popup-notice-body";
    const copy = {
      access: [t("popupAccessRequiredTitle"), t("popupAccessRequiredBody")],
      unadded: [t("popupSiteNotAddedTitle"), t("popupSiteNotAddedBody", [getPageLabel(currentTab) ?? ""])],
      refresh: [t("popupReloadTitle"), t("popupReloadBody")],
      unavailable: [t("popupOpenAo3PageTitle"), t("popupOpenAo3PageBody")],
      error: [t("popupSettingsLoadErrorTitle"), t("popupSettingsLoadErrorBody")],
    }[pageState];
    title.textContent = copy[0];
    body.textContent = copy[1];
    notice.append(title, body);

    const feedback = document.createElement("p");
    feedback.className = "popup-notice-feedback";
    feedback.setAttribute("role", "alert");
    feedback.hidden = true;
    const showError = (text: string): void => {
      feedback.textContent = text;
      feedback.hidden = false;
    };

    if (pageState === "access") {
      notice.dataset.popupAccessNotice = "true";
      const grantButton = createButton(t("popupGrantAccess"), true);
      grantButton.classList.add("popup-notice-action");
      grantButton.dataset.popupGrantAccess = "true";
      grantButton.addEventListener("click", () => {
        // Firefox requires the permission request to start inside the user gesture.
        let request: Promise<boolean>;
        try {
          request = deps.requestAo3Access();
        } catch (error) {
          deps.logError(error);
          showError(t("popupAccessDenied"));
          return;
        }
        const restoreFocus = document.activeElement === grantButton;
        grantButton.disabled = true;
        feedback.hidden = true;
        void request.catch((error: unknown) => {
          deps.logError(error);
          return false;
        }).then((granted) => {
          if (!granted) {
            grantButton.disabled = false;
            showError(t("popupAccessDenied"));
            return;
          }
          pageState = "refresh";
          updateNotice();
          syncUi();
          if (restoreFocus) notice.querySelector<HTMLButtonElement>("[data-popup-reload]")?.focus();
        });
      });
      notice.appendChild(grantButton);
    } else if (pageState === "refresh" && currentTab?.id != null) {
      const reloadButton = createButton(t("popupReloadPage"), true);
      reloadButton.classList.add("popup-notice-action");
      reloadButton.dataset.popupReload = "true";
      reloadButton.addEventListener("click", () => {
        reloadButton.disabled = true;
        feedback.hidden = true;
        void deps.reloadTab(currentTab.id!).then(() => deps.closePopup()).catch((error: unknown) => {
          deps.logError(error);
          reloadButton.disabled = false;
          showError(t("popupReloadError"));
        });
      });
      notice.appendChild(reloadButton);
    }
    notice.appendChild(feedback);
  };

  const statsSection = document.createElement("section");
  statsSection.className = "popup-stats";
  const updateStats = (): void => {
    statsSection.textContent = "";
    if (stats) renderStats(statsSection, stats, settings);
  };
  shell.appendChild(statsSection);

  const actions = document.createElement("section");
  actions.className = "popup-actions";
  const manageButton = createButton(t("popupManageRules"), true);
  manageButton.dataset.popupOptions = "true";
  manageButton.addEventListener("click", () => {
    deps.openOptionsPage();
    deps.closePopup();
  });
  const hoverSetting = createHoverButtonSetting(settings, inputMode);
  const hoverToggle = hoverSetting.querySelector<HTMLInputElement>("[data-popup-hover-toggle]")!;
  const hoverStatus = hoverSetting.querySelector<HTMLElement>("[data-popup-hover-status]")!;
  const hoverDescription = hoverSetting.querySelector<HTMLElement>(".popup-setting-description")!;
  const hoverSaveStatus = hoverSetting.querySelector<HTMLElement>("[data-popup-hover-save-status]")!;
  actions.append(manageButton, hoverSetting);
  shell.appendChild(actions);

  attachSettingToggle(globalToggle, "extensionEnabled", globalControl.status, globalControl.saveStatus, deps,
    getExtensionStateLabel, {
      onSaveStart: () => { globalSaving = true; syncUi(); },
      onSaveSuccess: async (enabled) => {
        settings.extensionEnabled = enabled;
        syncUi();
        if (enabled) {
          stats = await getCurrentPageStats(deps, currentTab);
          const nextPageState = await getPageState(deps, currentTab, stats);
          // Permission recovery can succeed while the original tab snapshot has
          // no URL. Keep that confirmed reload state until the page responds.
          if (nextPageState !== "unavailable" || pageState !== "refresh" || currentTab?.url) {
            pageState = nextPageState;
          }
          updateNotice();
          updateStats();
        }
      },
      onSaveEnd: () => { globalSaving = false; syncUi(); },
    });
  attachSettingToggle(hoverToggle, "hoverButtonEnabled", hoverStatus, hoverSaveStatus, deps, getOnOffLabel, {
    onSaveStart: () => { hoverSaving = true; syncUi(); },
    onSaveSuccess: (enabled) => { settings.hoverButtonEnabled = enabled; },
    onSaveEnd: () => { hoverSaving = false; syncUi(); },
  });
  updateNotice();
  updateStats();
  syncUi();
}

async function getCurrentTabSafely(deps: PopupAppDeps): Promise<CurrentTab | null> {
  try {
    return await deps.getCurrentTab();
  } catch (error) {
    deps.logError(error);
    return null;
  }
}

async function getCurrentPageStats(deps: PopupAppDeps, currentTab: CurrentTab | null): Promise<HitStats | null> {
  if (currentTab?.id == null) return null;
  try {
    const response = await deps.sendMessageToTab(currentTab.id, { type: "GET_HIT_STATS" });
    return isHitStats(response) ? response : null;
  } catch {
    return null;
  }
}

async function getPageState(deps: PopupAppDeps, tab: CurrentTab | null, stats: HitStats | null): Promise<PageState> {
  // A responding script proves coverage, including site-only grants on Chromium.
  if (stats) return "active";
  if (tab?.id == null) return "unavailable";
  let url: URL | null;
  try {
    url = tab.url ? new URL(tab.url) : null;
  } catch {
    return "unavailable";
  }
  if (url && url.protocol !== "https:") return "unavailable";
  try {
    // Without tabs/activeTab, an ungranted site's URL may be hidden. Still offer
    // the existing global AO3 permission recovery if official access is off.
    const allowed = await deps.hasSiteAccess(url?.href ?? "https://archiveofourown.org/");
    if (!url) return allowed ? "unavailable" : "access";
    if (allowed) return "refresh";
  } catch (error) {
    deps.logError(error);
    return "unavailable";
  }
  return isAo3Host(url.hostname) ? "access" : "unadded";
}

function renderHeader(container: HTMLElement, settings: Settings, pageLabelText: string | null): {
  toggle: HTMLInputElement; status: HTMLElement; saveStatus: HTMLElement;
} {
  const header = document.createElement("header");
  header.className = "popup-header";
  const brand = document.createElement("div");
  brand.className = "popup-brand";
  const title = document.createElement("h1");
  title.className = "popup-title";
  title.textContent = t("extensionName");
  brand.appendChild(title);
  if (pageLabelText) {
    const pageLabel = document.createElement("p");
    pageLabel.className = "popup-page-label";
    pageLabel.textContent = pageLabelText;
    brand.appendChild(pageLabel);
  }

  const control = document.createElement("div");
  control.className = "popup-header-control";
  const switchLabel = document.createElement("label");
  switchLabel.className = "popup-switch";
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
  switchLabel.append(toggle, createSwitchTrack());
  control.append(switchLabel, status, saveStatus);
  header.append(brand, control);
  container.appendChild(header);
  return { toggle, status, saveStatus };
}

function renderStats(container: HTMLElement, stats: HitStats, settings: Settings): void {
  const rows: Array<[string, string, number]> = [
    [t("popupStatHighlightTags", [getLocalizedActionLabel("highlight", settings.actionStyles)]), "highlight", stats.highlight],
    [getLocalizedActionLabel("warn", settings.actionStyles), "warn", stats.warn],
    [t("popupStatCollapseWork"), "hideWork", stats.hideWork],
  ];
  for (const [label, key, count] of rows) {
    const row = document.createElement("div");
    row.className = "popup-stat-row";
    row.dataset.stat = key;
    const labelElement = document.createElement("span");
    labelElement.className = "popup-stat-label";
    labelElement.textContent = label;
    const value = document.createElement("strong");
    value.className = "popup-stat-value";
    value.textContent = String(count);
    row.append(labelElement, value);
    container.appendChild(row);
  }
}

function createHoverButtonSetting(settings: Settings, inputMode: QuickAddInputMode): HTMLElement {
  const touch = inputMode === "touch";
  const wrapper = document.createElement("label");
  wrapper.className = "popup-setting-row";
  const copy = document.createElement("span");
  copy.className = "popup-setting-copy";
  const title = document.createElement("span");
  title.className = "popup-setting-title";
  title.textContent = touch ? t("popupTouchQuickAdd") : t("popupTagHoverQuickAdd");
  const description = document.createElement("span");
  description.className = "popup-setting-description";
  description.textContent = touch ? t("popupTouchQuickAddDescription") : t("popupTagHoverQuickAddDescription");
  const statusRow = document.createElement("span");
  statusRow.className = "popup-setting-status-row";
  const status = document.createElement("span");
  status.className = "popup-setting-status";
  status.dataset.popupHoverStatus = "true";
  const saveStatus = document.createElement("span");
  saveStatus.className = "popup-save-status";
  saveStatus.dataset.popupHoverSaveStatus = "true";
  saveStatus.setAttribute("aria-live", "polite");
  statusRow.append(status, saveStatus);
  copy.append(title, description, statusRow);
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = settings.hoverButtonEnabled;
  toggle.dataset.popupHoverToggle = "true";
  toggle.setAttribute("aria-label", touch ? t("popupTouchQuickAddEnabledAria") : t("popupTagHoverQuickAddEnabledAria"));
  wrapper.append(copy, toggle, createSwitchTrack());
  return wrapper;
}

function createButton(text: string, primary = false): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = primary ? "popup-button popup-button-primary" : "popup-button";
  button.textContent = text;
  return button;
}

function createSwitchTrack(): HTMLElement {
  const track = document.createElement("span");
  track.className = "popup-switch-track";
  const knob = document.createElement("span");
  knob.className = "popup-switch-knob";
  track.appendChild(knob);
  return track;
}

function attachSettingToggle(
  toggle: HTMLInputElement,
  settingKey: ToggleSettingKey,
  stateElement: HTMLElement,
  saveStatusElement: HTMLElement,
  deps: PopupAppDeps,
  getStateLabel: (enabled: boolean) => string,
  options: ToggleCallbacks = {}
): void {
  toggle.addEventListener("change", () => {
    void saveToggleSetting(toggle, settingKey, stateElement, saveStatusElement, deps, getStateLabel, options);
  });
}

async function saveToggleSetting(
  toggle: HTMLInputElement,
  settingKey: ToggleSettingKey,
  stateElement: HTMLElement,
  saveStatusElement: HTMLElement,
  deps: PopupAppDeps,
  getStateLabel: (enabled: boolean) => string,
  options: ToggleCallbacks
): Promise<void> {
  const previousChecked = !toggle.checked;
  const nextChecked = toggle.checked;
  const hadFocus = document.activeElement === toggle;
  toggle.disabled = true;
  stateElement.textContent = getStateLabel(nextChecked);
  saveStatusElement.textContent = "";
  delete saveStatusElement.dataset.status;
  options.onSaveStart?.();
  try {
    await deps.saveSettings({ [settingKey]: nextChecked });
    await options.onSaveSuccess?.(nextChecked);
  } catch (error) {
    toggle.checked = previousChecked;
    stateElement.textContent = getStateLabel(previousChecked);
    saveStatusElement.textContent = t("popupSaveError");
    saveStatusElement.dataset.status = "error";
    deps.logError(error);
  } finally {
    toggle.disabled = false;
    options.onSaveEnd?.();
    if (hadFocus && !toggle.disabled && document.activeElement === document.body) {
      toggle.focus({ preventScroll: true });
    }
  }
}

function getExtensionStateLabel(enabled: boolean): string {
  return enabled ? t("popupGlobalOn") : t("popupGlobalPaused");
}

function getOnOffLabel(enabled: boolean): string {
  return enabled ? t("labelOn") : t("labelOff");
}

function getPageLabel(tab: CurrentTab | null): string | null {
  if (!tab?.url) return null;
  try {
    const url = new URL(tab.url);
    if (isAo3Host(url.hostname)) {
      return /^\/works\/\d+(?:\/|$)/.test(url.pathname) ? t("popupAo3WorkPage") : t("popupAo3Page");
    }
    return url.hostname || null;
  } catch {
    return null;
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
      const tabsApi = getExtensionApi<ChromeLike>().tabs;
      if (!tabsApi) return null;
      const [tab] = await tabsApi.query({ active: true, currentWindow: true });
      return tab ?? null;
    },
    sendMessageToTab: async (tabId, message) => {
      const tabsApi = getExtensionApi<ChromeLike>().tabs;
      if (!tabsApi) throw new Error("Extension tabs API is unavailable");
      return tabsApi.sendMessage(tabId, message);
    },
    openOptionsPage: () => { getExtensionApi<ChromeLike>().runtime?.openOptionsPage(); },
    closePopup: () => { window.close(); },
    hasSiteAccess: async (url) => {
      const permissionsApi = getExtensionApi<ChromeLike>().permissions;
      if (!permissionsApi) throw new Error("Extension permissions API is unavailable");
      return permissionsApi.contains({ origins: [`${new URL(url).origin}/*`] });
    },
    requestAo3Access: async () => {
      const permissionsApi = getExtensionApi<ChromeLike>().permissions;
      if (!permissionsApi) return false;
      return permissionsApi.request({ origins: [AO3_ORIGIN_PATTERN] });
    },
    reloadTab: async (tabId) => {
      const tabsApi = getExtensionApi<ChromeLike>().tabs;
      if (!tabsApi) throw new Error("Extension tabs API is unavailable");
      await tabsApi.reload(tabId);
    },
    detectInputMode: () => detectInputMode(),
    logError: (error) => { console.error(`${LOG_PREFIX} Popup error:`, error); },
  };
}

function isHitStats(value: unknown): value is HitStats {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const stats = value as Record<string, unknown>;
  return typeof stats.highlight === "number" && typeof stats.warn === "number" &&
    typeof stats.hideWork === "number" && typeof stats.totalRules === "number";
}

export function createEmptyStats(): HitStats {
  return { ...EMPTY_STATS };
}
