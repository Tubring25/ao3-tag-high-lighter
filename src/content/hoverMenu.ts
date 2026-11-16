import type { ParsedTag, ParsedWork, Rule, Settings } from "../core/types";
import { DEFAULT_ACTION_STYLES } from "../core/actionStyles";
import { LOG_PREFIX } from "../shared/constants";
import { formatRuleSaveError } from "../shared/ruleError";
import { getEffectiveLanguageTag, getLocalizedCustomizableActionLabel, t } from "../shared/i18n";
import { detectInputMode, type QuickAddInputMode } from "../shared/inputMode";
import { addRule as defaultAddRule } from "../storage/ruleStorage";
import { showToast as defaultShowToast } from "./toast";

type QuickAddRuleInput = Omit<Rule, "id" | "createdAt" | "updatedAt">;

export interface HoverMenuOptions {
  addRule?: (input: QuickAddRuleInput) => Promise<Rule>;
  onRuleCreated: () => void | Promise<void>;
  showToast?: (message: string) => void;
  inputMode?: QuickAddInputMode;
}

const MENU_ACTIONS: readonly Rule["action"][] = ["highlight", "warn", "hideWork"];

const BUTTON_SIZE_PX = 18;
const HIDE_DELAY_MS = 180;
const FONT_STACK = `"Funnel Sans", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", Verdana, Geneva, sans-serif`;

let shadowHost: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let currentTag: ParsedTag | null = null;
let lockedMenuTag: ParsedTag | null = null;
let hoveredTagElement: HTMLElement | null = null;
let hoverButton: HTMLButtonElement | null = null;
let hoverMenu: HTMLElement | null = null;
let hideTimeout: ReturnType<typeof setTimeout> | null = null;
let removeListeners: Array<() => void> = [];
let activeInputMode: QuickAddInputMode = "pointer";
let touchPickModeActive = false;
let touchToggle: HTMLButtonElement | null = null;
let pickBar: HTMLElement | null = null;
let pickableTagElements: HTMLElement[] = [];

export function mountHoverMenu(
  works: readonly ParsedWork[],
  settings: Settings,
  options: HoverMenuOptions
): void {
  unmountHoverMenu();

  if (!settings.hoverButtonEnabled) {
    touchPickModeActive = false;
    return;
  }
  if (works.length === 0) return;

  const inputMode = options.inputMode ?? detectInputMode();
  activeInputMode = inputMode;
  const root = ensureShadowRoot();
  injectShadowStyles(root, settings);

  hoverMenu = createMenu(settings, inputMode);

  if (inputMode === "touch") {
    mountTouchMode(works, root);
  } else {
    touchPickModeActive = false;
    mountPointerMode(works, root);
  }

  addManagedListener(hoverMenu, "click", (event) => {
    void handleMenuClick(event, settings, options).catch((error) => {
      console.error(`${LOG_PREFIX} Hover menu error:`, error);
    });
  });

  addManagedListener(hoverMenu, "keydown", (event) => {
    if (!(event instanceof KeyboardEvent) || !hoverMenu) return;
    const items = Array.from(hoverMenu.querySelectorAll<HTMLButtonElement>("[data-ao3th-menu-option]:not(:disabled)"));
    const index = items.indexOf(shadowRoot?.activeElement as HTMLButtonElement);
    let next: number;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key === "Tab") { dismissMenu(); return; }
    else return;
    event.preventDefault();
    items[next]?.focus();
  });
  addManagedListener(document, "click", (event) => {
    if (shadowHost && event.composedPath().includes(shadowHost)) return;
    dismissMenu();
  });
  addManagedListener(document, "keydown", (event) => {
    if (event instanceof KeyboardEvent && event.key === "Escape") {
      dismissMenu();
    }
  });
}

export function unmountHoverMenu(options: { resetPickMode?: boolean } = {}): void {
  const returnTarget = shadowRoot?.activeElement ? lockedMenuTag?.element ?? currentTag?.element : null;
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  for (const removeListener of removeListeners) {
    removeListener();
  }

  if (options.resetPickMode) touchPickModeActive = false;
  removeListeners = [];
  currentTag = null;
  lockedMenuTag = null;
  setHoveredTagElement(null);
  hoverButton = null;
  hoverMenu = null;
  touchToggle = null;
  pickBar = null;
  pickableTagElements = [];
  activeInputMode = "pointer";
  shadowRoot = null;
  shadowHost?.remove();
  shadowHost = null;
  if (returnTarget?.isConnected) returnTarget.focus();
}

function mountPointerMode(works: readonly ParsedWork[], root: ShadowRoot): void {
  if (!hoverMenu) return;
  hoverButton = createButton();
  root.append(hoverButton, hoverMenu);

  for (const work of works) {
    for (const tag of work.tags) {
      addManagedListener(tag.element, "mouseenter", () => {
        cancelHide();
        if (isMenuOpen()) return;
        currentTag = tag;
        setHoveredTagElement(tag.element);
        showButton(tag.element);
      });

      const previousDescription = tag.element.getAttribute("aria-description");
      const previousShortcut = tag.element.getAttribute("aria-keyshortcuts");
      tag.element.setAttribute("aria-description", [previousDescription, t("hoverKeyboardHint")].filter(Boolean).join(". "));
      tag.element.setAttribute("aria-keyshortcuts", "Alt+ArrowDown");
      removeListeners.push(() => {
        if (previousDescription === null) tag.element.removeAttribute("aria-description");
        else tag.element.setAttribute("aria-description", previousDescription);
        if (previousShortcut === null) tag.element.removeAttribute("aria-keyshortcuts");
        else tag.element.setAttribute("aria-keyshortcuts", previousShortcut);
      });
      addManagedListener(tag.element, "focus", () => {
        cancelHide();
        if (isMenuOpen()) return;
        currentTag = tag;
        setHoveredTagElement(tag.element);
        showButton(tag.element);
      });
      addManagedListener(tag.element, "keydown", (event) => {
        if (!(event instanceof KeyboardEvent)) return;
        if (event.key === "Tab" && !event.shiftKey && hoverButton && !hoverButton.hidden && !isMenuOpen()) {
          event.preventDefault();
          hoverButton.focus();
          return;
        }
        if (!event.altKey || event.key !== "ArrowDown") return;
        event.preventDefault();
        currentTag = tag;
        showButton(tag.element);
        showMenu();
      });
      addManagedListener(tag.element, "blur", scheduleHide);
      addManagedListener(tag.element, "mouseleave", scheduleHide);
    }
  }

  addManagedListener(hoverButton, "keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.key === "ArrowDown") { event.preventDefault(); showMenu(); }
    if (event.key === "Tab") {
      if (event.shiftKey) event.preventDefault();
      hideMenuAndButton();
    }
  });
  addManagedListener(hoverButton, "mouseenter", cancelHide);
  addManagedListener(hoverButton, "mouseleave", scheduleHide);
  addManagedListener(hoverButton, "click", (event) => {
    event.stopPropagation();
    showMenu();
  });

  addManagedListener(hoverMenu, "mouseenter", cancelHide);
  addManagedListener(hoverMenu, "mouseleave", scheduleHide);
  addManagedListener(root, "focusin", cancelHide);
  addManagedListener(root, "focusout", scheduleHide);
  addManagedListener(window, "scroll", hideMenuAndButton, { passive: true });
}

function mountTouchMode(works: readonly ParsedWork[], root: ShadowRoot): void {
  if (!hoverMenu) return;
  touchToggle = createTouchToggle();
  pickBar = createPickBar();
  root.append(touchToggle, pickBar, hoverMenu);

  document.documentElement.setAttribute("data-ao3th-touch-ui", "true");
  removeListeners.push(() => document.documentElement.removeAttribute("data-ao3th-touch-ui"));

  for (const work of works) {
    for (const tag of work.tags) {
      pickableTagElements.push(tag.element);
      addManagedListener(tag.element, "click", (event) => {
        if (!touchPickModeActive) return;
        event.preventDefault();
        event.stopPropagation();
        openSheet(tag);
      });
    }
  }
  removeListeners.push(() => {
    for (const element of pickableTagElements) element.removeAttribute("data-ao3th-pickable");
  });

  addManagedListener(touchToggle, "click", () => {
    setPickMode(true);
    pickBar?.querySelector<HTMLButtonElement>("[data-ao3th-pick-done]")?.focus();
  });
  const doneButton = pickBar.querySelector<HTMLButtonElement>("[data-ao3th-pick-done]");
  if (doneButton) {
    addManagedListener(doneButton, "click", () => {
      closeSheet();
      setPickMode(false);
      touchToggle?.focus();
    });
  }
  const cancelButton = hoverMenu.querySelector<HTMLButtonElement>("[data-ao3th-menu-cancel]");
  if (cancelButton) addManagedListener(cancelButton, "click", closeSheet);

  syncTouchUi();
}

async function handleMenuClick(
  event: Event,
  settings: Settings,
  options: HoverMenuOptions
): Promise<void> {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const option = target.closest<HTMLButtonElement>("[data-ao3th-menu-option]");
  if (!option || !lockedMenuTag) return;

  const action = option.dataset.action as Rule["action"] | undefined;
  if (!isRuleAction(action)) return;

  const selectedTag = lockedMenuTag;
  const menu = hoverMenu;
  if (!menu || menu.getAttribute("aria-busy") === "true") return;
  const buttons = Array.from(menu.querySelectorAll<HTMLButtonElement>("button"));
  const errorNotice = menu.querySelector<HTMLElement>("[role=alert]");
  if (errorNotice) errorNotice.textContent = "";
  menu.setAttribute("aria-busy", "true");
  buttons.forEach((button) => { button.disabled = true; });
  menu.focus();
  try {
    await (options.addRule ?? defaultAddRule)({
      pattern: selectedTag.text,
      action,
      matchMode: "exact",
      category: selectedTag.category,
      enabled: true,
      source: "quickAdd",
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Hover menu error:`, error);
    if (errorNotice) errorNotice.textContent = formatRuleSaveError(error);
    option.textContent = `${getQuickAddActionLabel(action, settings)} — ${t("ruleRetry")}`;
    return;
  } finally {
    menu.setAttribute("aria-busy", "false");
    buttons.forEach((button) => { button.disabled = false; });
    if (menu === hoverMenu && isMenuOpen()) option.focus();
  }

  if (menu === hoverMenu) dismissMenu();
  await options.onRuleCreated();

  if (settings.showToast) {
    (options.showToast ?? defaultShowToast)(t("toastRuleCreated", [selectedTag.text]));
  }
}

function ensureShadowRoot(): ShadowRoot {
  if (shadowRoot) return shadowRoot;

  shadowHost = document.createElement("div");
  shadowHost.id = "ao3th-hover-host";
  shadowHost.lang = getEffectiveLanguageTag();
  shadowHost.style.position = "fixed";
  shadowHost.style.inset = "0";
  shadowHost.style.zIndex = "999999";
  shadowHost.style.pointerEvents = "none";
  shadowRoot = shadowHost.attachShadow({ mode: "open" });
  document.body.appendChild(shadowHost);
  return shadowRoot;
}

function injectShadowStyles(root: ShadowRoot, settings: Settings): void {
  const style = document.createElement("style");
  const { highlight, warn } = settings.actionStyles;
  style.textContent = `
    [data-ao3th-hover-button] {
      position: fixed;
      width: 18px;
      height: 18px;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: #990000;
      color: #ffffff;
      box-shadow: none;
      cursor: pointer;
      font: 700 13px/1 ${FONT_STACK};
      opacity: 0.8;
      pointer-events: auto;
      z-index: 1;
    }

    [data-ao3th-hover-button]:focus-visible {
      opacity: 1;
    }

    [data-ao3th-hover-button][data-ao3th-active="true"] {
      opacity: 1;
    }

    [data-ao3th-hover-menu] {
      position: fixed;
      box-sizing: border-box;
      width: min(260px, calc(100vw - 16px));
      padding: 12px;
      border: 1px solid #111111;
      border-radius: 0;
      background: #ffffff;
      color: #111111;
      box-shadow: none;
      pointer-events: auto;
      z-index: 2;
      overflow: hidden;
      font-family: ${FONT_STACK};
    }

    [data-ao3th-menu-title] {
      margin: 0;
      color: #111111;
      font: 600 14px/1.25 ${FONT_STACK};
    }

    [data-ao3th-menu-options] {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 6px;
    }

    [data-ao3th-menu-option] {
      display: block;
      box-sizing: border-box;
      width: 100%;
      padding: 7px 8px;
      border: 1px solid #d8d1c8;
      border-radius: 0;
      background: #ffffff;
      color: #990000;
      cursor: pointer;
      font: 400 13px/1.25 ${FONT_STACK};
      text-align: left;
    }

    [data-action="highlight"] {
      background: ${highlight.backgroundColor};
      color: ${highlight.textColor};
    }

    [data-action="warn"] {
      background: ${warn.backgroundColor};
      color: ${warn.textColor};
    }

    [data-ao3th-menu-option]:focus-visible {
      background: #f3f4f6;
      border-color: #b8b0a7;
    }

    [data-action="highlight"]:focus-visible {
      background: #ffe9b5;
    }

    [data-action="warn"]:focus-visible {
      background: #ead8d4;
    }

    @media (hover: hover) {
      [data-ao3th-hover-button]:hover {
        opacity: 1;
      }

      [data-ao3th-menu-option]:hover {
        background: #f3f4f6;
        border-color: #b8b0a7;
      }

      [data-action="highlight"]:hover {
        background: #ffe9b5;
      }

      [data-action="warn"]:hover {
        background: #ead8d4;
      }
    }

    [data-ao3th-touch-toggle] {
      position: fixed;
      right: calc(12px + env(safe-area-inset-right));
      bottom: calc(12px + env(safe-area-inset-bottom));
      width: 48px;
      height: 48px;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: #990000;
      color: #ffffff;
      cursor: pointer;
      font: 700 24px/1 ${FONT_STACK};
      pointer-events: auto;
    }

    [data-ao3th-touch-toggle][hidden],
    [data-ao3th-pick-bar][hidden] {
      display: none;
    }

    [data-ao3th-pick-bar] {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      box-sizing: border-box;
      padding: 10px calc(12px + env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-left));
      border-top: 1px solid #111111;
      background: #ffffff;
      color: #111111;
      font: 400 15px/1.3 ${FONT_STACK};
      pointer-events: auto;
    }

    [data-ao3th-pick-bar] button,
    [data-ao3th-menu-cancel] {
      min-height: 44px;
      padding: 0 16px;
      border: 1px solid #111111;
      border-radius: 0;
      background: #ffffff;
      color: #111111;
      cursor: pointer;
      font: 600 15px/1 ${FONT_STACK};
    }

    [data-ao3th-hover-menu][data-ao3th-layout="sheet"] {
      left: 0 !important;
      right: 0;
      top: auto !important;
      bottom: 0;
      width: 100%;
      padding: 16px calc(16px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left));
      border-width: 1px 0 0;
      z-index: 3;
    }

    [data-ao3th-layout="sheet"] [data-ao3th-menu-option] {
      min-height: 44px;
      font-size: 16px;
    }

    [data-ao3th-layout="sheet"] [data-ao3th-menu-cancel] {
      width: 100%;
      margin-top: 8px;
    }
`;
  root.appendChild(style);
}

function createButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "+";
  button.dataset.ao3thHoverButton = "true";
  button.dataset.ao3thActive = "false";
  button.setAttribute("aria-label", t("hoverQuickAddAria"));
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-controls", "ao3th-quick-add-menu");
  button.hidden = true;
  return button;
}

function createTouchToggle(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "+";
  button.dataset.ao3thTouchToggle = "true";
  button.setAttribute("aria-label", t("touchQuickAddToggleAria"));
  button.setAttribute("aria-pressed", "false");
  return button;
}

function createPickBar(): HTMLElement {
  const bar = document.createElement("div");
  bar.dataset.ao3thPickBar = "true";
  bar.setAttribute("role", "status");
  bar.hidden = true;

  const hint = document.createElement("span");
  hint.textContent = t("touchPickModeHint");

  const done = document.createElement("button");
  done.type = "button";
  done.dataset.ao3thPickDone = "true";
  done.textContent = t("touchPickModeDone");

  bar.append(hint, done);
  return bar;
}

function createMenu(settings: Settings, inputMode: QuickAddInputMode): HTMLElement {
  const menu = document.createElement("div");
  menu.dataset.ao3thHoverMenu = "true";
  menu.id = "ao3th-quick-add-menu";
  menu.tabIndex = -1;
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", t("hoverMenuAria"));
  menu.hidden = true;

  const title = document.createElement("p");
  title.dataset.ao3thMenuTitle = "true";

  const options = document.createElement("div");
  options.dataset.ao3thMenuOptions = "true";

  for (const action of MENU_ACTIONS) {
    const option = document.createElement("button");
    option.type = "button";
    option.dataset.ao3thMenuOption = "true";
    option.dataset.action = action;
    option.setAttribute("role", "menuitem");
    option.textContent = getQuickAddActionLabel(action, settings);
    options.appendChild(option);
  }

  const errorNotice = document.createElement("p");
  errorNotice.setAttribute("role", "alert");
  errorNotice.style.overflowWrap = "anywhere";
  menu.append(title, options);

  if (inputMode === "touch") {
    menu.dataset.ao3thLayout = "sheet";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.dataset.ao3thMenuCancel = "true";
    cancel.setAttribute("role", "menuitem");
    cancel.textContent = t("touchSheetCancel");
    menu.append(cancel);
  }

  menu.append(errorNotice);
  return menu;
}

function getQuickAddActionLabel(action: Rule["action"], settings: Settings): string {
  if (action === "hideWork") return t("actionCollapseWork");
  if (action === "highlight") {
    const label = getLocalizedCustomizableActionLabel("highlight", settings.actionStyles.highlight);
    return settings.actionStyles.highlight.label === DEFAULT_ACTION_STYLES.highlight.label
      ? t("actionHighlightTag")
      : t("actionCustomTag", [label]);
  }
  if (settings.actionStyles.warn.label === DEFAULT_ACTION_STYLES.warn.label) return t("actionWarnWork");
  return t("actionCustomWork", [getLocalizedCustomizableActionLabel("warn", settings.actionStyles.warn)]);
}

function showButton(tagElement: HTMLElement): void {
  if (!hoverButton) return;

  const rect = tagElement.getBoundingClientRect();
  const position = clampPosition(
    rect.right + 6,
    rect.top + (rect.height - BUTTON_SIZE_PX) / 2,
    BUTTON_SIZE_PX,
    BUTTON_SIZE_PX
  );
  hoverButton.style.left = `${position.left}px`;
  hoverButton.style.top = `${position.top}px`;
  hoverButton.hidden = false;
}

function showMenu(): void {
  if (!hoverMenu || !hoverButton || !currentTag || hoverMenu.getAttribute("aria-busy") === "true") return;
  cancelHide();
  const errorNotice = hoverMenu.querySelector<HTMLElement>("[role=alert]");
  if (errorNotice) errorNotice.textContent = "";

  lockedMenuTag = currentTag;
  updateMenuContext(hoverMenu, lockedMenuTag);
  hoverMenu.hidden = false;
  hoverButton.dataset.ao3thActive = "true";
  hoverButton.setAttribute("aria-expanded", "true");

  const tagRect = lockedMenuTag.element.getBoundingClientRect();
  const position = clampPosition(
    tagRect.left,
    tagRect.bottom + 6,
    hoverMenu.offsetWidth,
    hoverMenu.offsetHeight
  );
  hoverMenu.style.left = `${position.left}px`;
  hoverMenu.style.top = `${position.top}px`;

  hoverMenu.querySelector<HTMLButtonElement>("[data-ao3th-menu-option]")?.focus();
}

function openSheet(tag: ParsedTag): void {
  if (!hoverMenu || hoverMenu.getAttribute("aria-busy") === "true") return;
  const errorNotice = hoverMenu.querySelector<HTMLElement>("[role=alert]");
  if (errorNotice) errorNotice.textContent = "";

  currentTag = tag;
  lockedMenuTag = tag;
  setHoveredTagElement(tag.element);
  updateMenuContext(hoverMenu, tag);
  hoverMenu.hidden = false;
  hoverMenu.querySelector<HTMLButtonElement>("[data-ao3th-menu-option]")?.focus();
}

function closeSheet(): void {
  const returnTarget = lockedMenuTag?.element;
  const restoreFocus = Boolean(shadowRoot?.activeElement) && isMenuOpen();
  hoverMenu?.setAttribute("hidden", "");
  if (restoreFocus && returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
  currentTag = null;
  lockedMenuTag = null;
  setHoveredTagElement(null);
}

function dismissMenu(): void {
  if (activeInputMode === "touch") closeSheet();
  else hideMenuAndButton();
}

function setPickMode(active: boolean): void {
  touchPickModeActive = active;
  syncTouchUi();
}

function syncTouchUi(): void {
  if (touchToggle) {
    touchToggle.hidden = touchPickModeActive;
    touchToggle.setAttribute("aria-pressed", String(touchPickModeActive));
  }
  if (pickBar) pickBar.hidden = !touchPickModeActive;
  for (const element of pickableTagElements) {
    if (touchPickModeActive) element.setAttribute("data-ao3th-pickable", "true");
    else element.removeAttribute("data-ao3th-pickable");
  }
}

function hideMenuAndButton(): void {
  const returnTarget = lockedMenuTag?.element ?? currentTag?.element;
  const restoreFocus = Boolean(shadowRoot?.activeElement);
  cancelHide();
  hoverButton?.setAttribute("hidden", "");
  if (hoverButton) {
    hoverButton.dataset.ao3thActive = "false";
    hoverButton.setAttribute("aria-expanded", "false");
  }
  hoverMenu?.setAttribute("hidden", "");
  if (restoreFocus && returnTarget?.isConnected) returnTarget.focus();
  hoverButton?.setAttribute("hidden", "");
  currentTag = null;
  lockedMenuTag = null;
  setHoveredTagElement(null);
}

function scheduleHide(): void {
  cancelHide();
  hideTimeout = setTimeout(() => {
    if (shadowRoot?.activeElement || document.activeElement === currentTag?.element) return;
    hideMenuAndButton();
  }, HIDE_DELAY_MS);
}

function cancelHide(): void {
  if (!hideTimeout) return;
  clearTimeout(hideTimeout);
  hideTimeout = null;
}

function isMenuOpen(): boolean {
  return Boolean(hoverMenu && !hoverMenu.hidden);
}

function updateMenuContext(menu: HTMLElement, tag: ParsedTag): void {
  const title = menu.querySelector<HTMLElement>("[data-ao3th-menu-title]");

  if (title) title.textContent = t("hoverAddRuleFor", [tag.text]);
}

function setHoveredTagElement(element: HTMLElement | null): void {
  if (hoveredTagElement === element) return;
  hoveredTagElement?.removeAttribute("data-ao3th-hovered");
  hoveredTagElement = element;
  hoveredTagElement?.setAttribute("data-ao3th-hovered", "true");
}

function addManagedListener(
  target: EventTarget,
  type: string,
  listener: EventListener,
  options?: AddEventListenerOptions
): void {
  target.addEventListener(type, listener, options);
  removeListeners.push(() => target.removeEventListener(type, listener, options));
}

function clampPosition(
  left: number,
  top: number,
  width: number,
  height: number
): { left: number; top: number } {
  return {
    left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
    top: Math.max(8, Math.min(top, window.innerHeight - height - 8)),
  };
}

function isRuleAction(value: unknown): value is Rule["action"] {
  return (
    value === "highlight" || value === "warn" || value === "hideWork"
  );
}
