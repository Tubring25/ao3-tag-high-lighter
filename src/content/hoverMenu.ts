import type { ParsedTag, ParsedWork, Rule, Settings } from "../core/types";
import { LOG_PREFIX } from "../shared/constants";
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
  { action: "highlight", label: "Highlight tag" },
  { action: "warn", label: "Warn work" },
  { action: "hideWork", label: "Collapse work" },
];

const BUTTON_SIZE_PX = 18;
const HIDE_DELAY_MS = 180;

let shadowHost: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let currentTag: ParsedTag | null = null;
let hoveredTagElement: HTMLElement | null = null;
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
        setHoveredTagElement(tag.element);
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
    void handleMenuClick(event, settings, options).catch((error) => {
      console.error(`${LOG_PREFIX} Hover menu error:`, error);
    });
  });

  addManagedListener(document, "click", hideMenuAndButton);
  addManagedListener(document, "keydown", (event) => {
    if (event instanceof KeyboardEvent && event.key === "Escape") {
      hideMenuAndButton();
    }
  });
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
  setHoveredTagElement(null);
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
      width: 18px;
      height: 18px;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: #990000;
      color: #ffffff;
      box-shadow: none;
      cursor: pointer;
      font: 700 13px/1 "Funnel Sans", Verdana, Geneva, sans-serif;
      opacity: 0.8;
      pointer-events: auto;
      z-index: 1;
    }

    [data-ao3th-hover-button]:hover,
    [data-ao3th-hover-button]:focus-visible {
      opacity: 1;
      outline: none;
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
      font-family: "Funnel Sans", Verdana, Geneva, sans-serif;
    }

    [data-ao3th-menu-title] {
      margin: 0;
      color: #111111;
      font: 600 14px/1.25 "Funnel Sans", Verdana, Geneva, sans-serif;
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
      font: 400 13px/1.25 "Funnel Sans", Verdana, Geneva, sans-serif;
      text-align: left;
    }

    [data-action="highlight"] {
      background: #fff3db;
      color: #111111;
    }

    [data-action="warn"] {
      background: #f5e9e7;
    }

    [data-ao3th-menu-option]:hover,
    [data-ao3th-menu-option]:focus-visible {
      outline: 2px solid rgba(153, 0, 0, 0.28);
      outline-offset: 1px;
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
  button.setAttribute("aria-label", "Quick add AO3 tag rule");
  button.setAttribute("aria-expanded", "false");
  button.hidden = true;
  return button;
}

function createMenu(): HTMLElement {
  const menu = document.createElement("div");
  menu.dataset.ao3thHoverMenu = "true";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "Quick add tag rule");
  menu.hidden = true;

  const title = document.createElement("p");
  title.dataset.ao3thMenuTitle = "true";

  const options = document.createElement("div");
  options.dataset.ao3thMenuOptions = "true";

  for (const item of MENU_ACTIONS) {
    const option = document.createElement("button");
    option.type = "button";
    option.dataset.ao3thMenuOption = "true";
    option.dataset.action = item.action;
    option.setAttribute("role", "menuitem");
    option.textContent = item.label;
    options.appendChild(option);
  }

  menu.append(title, options);
  return menu;
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
  if (!hoverMenu || !hoverButton || !currentTag) return;

  updateMenuContext(hoverMenu, currentTag);
  hoverMenu.hidden = false;
  hoverButton.dataset.ao3thActive = "true";
  hoverButton.setAttribute("aria-expanded", "true");

  const tagRect = currentTag.element.getBoundingClientRect();
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

function hideMenuAndButton(): void {
  hoverButton?.setAttribute("hidden", "");
  if (hoverButton) {
    hoverButton.dataset.ao3thActive = "false";
    hoverButton.setAttribute("aria-expanded", "false");
  }
  hoverMenu?.setAttribute("hidden", "");
  currentTag = null;
  setHoveredTagElement(null);
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

function updateMenuContext(menu: HTMLElement, tag: ParsedTag): void {
  const title = menu.querySelector<HTMLElement>("[data-ao3th-menu-title]");

  if (title) title.textContent = `Add rule for “${tag.text}”`;
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
