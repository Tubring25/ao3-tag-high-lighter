import type { ParsedTag, ParsedWork, Rule, Settings } from "../core/types";
import { addRule as defaultAddRule } from "../storage/ruleStorage";
import { showToast as defaultShowToast } from "./toast";

type QuickAddRuleInput = Omit<Rule, "id" | "createdAt" | "updatedAt">;

export interface HoverMenuOptions {
  addRule?: (input: QuickAddRuleInput) => Promise<Rule>;
  onRuleCreated: () => void | Promise<void>;
  showToast?: (message: string) => void;
}

interface MenuAction {
  action: Rule["action"];
  label: string;
}

const MENU_ACTIONS: readonly MenuAction[] = [
  { action: "highlight", label: "Highlight" },
  { action: "warn", label: "Warn" },
  { action: "mute", label: "Mute" },
  { action: "hideWork", label: "Hide work" },
];

const HIDE_DELAY_MS = 180;

let shadowHost: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let currentTag: ParsedTag | null = null;
let hoverButton: HTMLButtonElement | null = null;
let hoverMenu: HTMLElement | null = null;
let hideTimeout: ReturnType<typeof setTimeout> | null = null;
let removeListeners: Array<() => void> = [];

export function mountHoverMenu(
  works: readonly ParsedWork[],
  settings: Settings,
  options: HoverMenuOptions
): void {
  unmountHoverMenu();

  if (!settings.hoverButtonEnabled || works.length === 0) return;

  const root = ensureShadowRoot();
  injectShadowStyles(root);

  hoverButton = createButton();
  hoverMenu = createMenu();
  root.append(hoverButton, hoverMenu);

  for (const work of works) {
    for (const tag of work.tags) {
      addManagedListener(tag.element, "mouseenter", () => {
        cancelHide();
        currentTag = tag;
        showButton(tag.element);
      });

      addManagedListener(tag.element, "mouseleave", scheduleHide);
    }
  }

  addManagedListener(hoverButton, "mouseenter", cancelHide);
  addManagedListener(hoverButton, "mouseleave", scheduleHide);
  addManagedListener(hoverButton, "click", (event) => {
    event.stopPropagation();
    showMenu();
  });

  addManagedListener(hoverMenu, "mouseenter", cancelHide);
  addManagedListener(hoverMenu, "mouseleave", scheduleHide);
  addManagedListener(hoverMenu, "click", (event) => {
    void handleMenuClick(event, settings, options);
  });

  addManagedListener(document, "click", hideMenuAndButton);
  addManagedListener(window, "scroll", hideMenuAndButton, { passive: true });
}

export function unmountHoverMenu(): void {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  for (const removeListener of removeListeners) {
    removeListener();
  }

  removeListeners = [];
  currentTag = null;
  hoverButton = null;
  hoverMenu = null;
  shadowRoot = null;
  shadowHost?.remove();
  shadowHost = null;
}

async function handleMenuClick(
  event: Event,
  settings: Settings,
  options: HoverMenuOptions
): Promise<void> {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const option = target.closest<HTMLButtonElement>("[data-ao3th-menu-option]");
  if (!option || !currentTag) return;

  const action = option.dataset.action as Rule["action"] | undefined;
  if (!isRuleAction(action)) return;

  const selectedTag = currentTag;
  await (options.addRule ?? defaultAddRule)({
    pattern: selectedTag.text,
    action,
    matchMode: "exact",
    category: selectedTag.category,
    enabled: true,
    source: "quickAdd",
  });

  hideMenuAndButton();
  await options.onRuleCreated();

  if (settings.showToast) {
    (options.showToast ?? defaultShowToast)(`Rule created: ${selectedTag.text}`);
  }
}

function ensureShadowRoot(): ShadowRoot {
  if (shadowRoot) return shadowRoot;

  shadowHost = document.createElement("div");
  shadowHost.id = "ao3th-hover-host";
  shadowHost.style.position = "fixed";
  shadowHost.style.inset = "0";
  shadowHost.style.zIndex = "999999";
  shadowHost.style.pointerEvents = "none";
  shadowRoot = shadowHost.attachShadow({ mode: "open" });
  document.body.appendChild(shadowHost);
  return shadowRoot;
}

function injectShadowStyles(root: ShadowRoot): void {
  const style = document.createElement("style");
  style.textContent = `
    [data-ao3th-hover-button] {
      position: fixed;
      width: 22px;
      height: 22px;
      border: 1px solid #6b7280;
      border-radius: 999px;
      background: #fffdf2;
      color: #374151;
      box-shadow: 0 2px 8px rgba(17, 24, 39, 0.18);
      cursor: pointer;
      font: 700 14px/1 sans-serif;
      pointer-events: auto;
      z-index: 1;
    }

    [data-ao3th-hover-menu] {
      position: fixed;
      min-width: 136px;
      padding: 4px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 10px 24px rgba(17, 24, 39, 0.18);
      pointer-events: auto;
      z-index: 2;
    }

    [data-ao3th-menu-option] {
      display: block;
      width: 100%;
      padding: 8px 10px;
      border: 0;
      border-radius: 5px;
      background: transparent;
      color: #1f2937;
      cursor: pointer;
      font: 13px/1.2 sans-serif;
      text-align: left;
    }

    [data-ao3th-menu-option]:hover {
      background: #f3f4f6;
    }
  `;
  root.appendChild(style);
}

function createButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "+";
  button.dataset.ao3thHoverButton = "true";
  button.hidden = true;
  return button;
}

function createMenu(): HTMLElement {
  const menu = document.createElement("div");
  menu.dataset.ao3thHoverMenu = "true";
  menu.hidden = true;

  for (const item of MENU_ACTIONS) {
    const option = document.createElement("button");
    option.type = "button";
    option.dataset.ao3thMenuOption = "true";
    option.dataset.action = item.action;
    option.textContent = item.label;
    menu.appendChild(option);
  }

  return menu;
}

function showButton(tagElement: HTMLElement): void {
  if (!hoverButton) return;

  const rect = tagElement.getBoundingClientRect();
  const position = clampPosition(rect.right + 4, rect.top + (rect.height - 22) / 2, 22, 22);
  hoverButton.style.left = `${position.left}px`;
  hoverButton.style.top = `${position.top}px`;
  hoverButton.hidden = false;
}

function showMenu(): void {
  if (!hoverMenu || !hoverButton || !currentTag) return;

  const rect = hoverButton.getBoundingClientRect();
  hoverMenu.hidden = false;

  const position = clampPosition(rect.right + 4, rect.top, hoverMenu.offsetWidth, hoverMenu.offsetHeight);
  hoverMenu.style.left = `${position.left}px`;
  hoverMenu.style.top = `${position.top}px`;
}

function hideMenuAndButton(): void {
  hoverButton?.setAttribute("hidden", "");
  hoverMenu?.setAttribute("hidden", "");
  currentTag = null;
}

function scheduleHide(): void {
  cancelHide();
  hideTimeout = setTimeout(hideMenuAndButton, HIDE_DELAY_MS);
}

function cancelHide(): void {
  if (!hideTimeout) return;
  clearTimeout(hideTimeout);
  hideTimeout = null;
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
    value === "highlight" || value === "warn" || value === "mute" || value === "hideWork"
  );
}
