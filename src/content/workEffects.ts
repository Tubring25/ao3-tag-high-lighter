import type { HideWorkMode, ParsedWork, WorkMatchSummary } from "../core/types";

const PLACEHOLDER_SELECTOR = "[data-ao3th-collapse-placeholder]";
const WARN_BANNER_SELECTOR = "[data-ao3th-warn-banner]";

interface WorkEffectOptions {
  hideWorkMode: HideWorkMode;
}

interface ClearWorkEffectOptions {
  preserveCollapseState?: boolean;
}

export function applyWorkEffects(
  work: ParsedWork,
  summary: WorkMatchSummary,
  options: WorkEffectOptions
): void {
  work.element.dataset.ao3thRuleIds = summary.matchedRuleIds.join(",");

  if (summary.hasWarn) {
    work.element.dataset.ao3thWarn = "true";
    if (!work.isWorkDetailPage) {
      ensureWarnBanner(work.element);
    }
  }

  if (!summary.hasHideWork || work.isWorkDetailPage) return;

  if (options.hideWorkMode === "hide") {
    work.element.dataset.ao3thHidden = "hide";
    work.element.hidden = true;
    return;
  }

  work.element.dataset.ao3thHidden = "collapse";
  work.element.hidden = false;
  ensureCollapsePlaceholder(work.element);
}

export function clearWorkEffects(work: ParsedWork, options: ClearWorkEffectOptions = {}): void {
  delete work.element.dataset.ao3thWarn;
  delete work.element.dataset.ao3thHidden;
  delete work.element.dataset.ao3thRuleIds;
  work.element.hidden = false;
  work.element.querySelector(WARN_BANNER_SELECTOR)?.remove();

  if (!options.preserveCollapseState) {
    delete work.element.dataset.ao3thExpanded;
    work.element.querySelector(PLACEHOLDER_SELECTOR)?.remove();
  }
}

function ensureWarnBanner(workElement: HTMLElement): void {
  if (workElement.querySelector(WARN_BANNER_SELECTOR)) return;

  const banner = document.createElement("div");
  banner.className = "ao3th-warn-banner";
  banner.dataset.ao3thWarnBanner = "true";
  banner.textContent = "This work contains warning tags.";

  const title = workElement.querySelector("h4.heading, h4");
  if (title?.parentElement === workElement) {
    title.insertAdjacentElement("afterend", banner);
    return;
  }

  workElement.prepend(banner);
}

function ensureCollapsePlaceholder(workElement: HTMLElement): void {
  if (workElement.querySelector(PLACEHOLDER_SELECTOR)) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ao3th-collapse-placeholder";
  button.dataset.ao3thCollapsePlaceholder = "true";
  renderCollapsePlaceholder(button, false);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const expanded = workElement.dataset.ao3thExpanded === "true";

    if (expanded) {
      delete workElement.dataset.ao3thExpanded;
      renderCollapsePlaceholder(button, false);
      return;
    }

    workElement.dataset.ao3thExpanded = "true";
    renderCollapsePlaceholder(button, true);
  });

  workElement.prepend(button);
}

function renderCollapsePlaceholder(button: HTMLButtonElement, expanded: boolean): void {
  const message = getOrCreatePlaceholderPart(button, "ao3th-collapse-message");
  setTextWithoutChildMutation(
    message,
    expanded ? "Collapsed work is expanded for this page." : "Work collapsed by hideWork rule."
  );

  const action = getOrCreatePlaceholderPart(button, "ao3th-collapse-action");
  setTextWithoutChildMutation(action, expanded ? "Hide again" : "Click to expand");
}

function getOrCreatePlaceholderPart(button: HTMLButtonElement, className: string): HTMLSpanElement {
  const existing = button.querySelector<HTMLSpanElement>(`.${className}`);
  if (existing) return existing;

  const part = document.createElement("span");
  part.className = className;
  button.append(part);

  return part;
}

function setTextWithoutChildMutation(element: HTMLElement, text: string): void {
  const textNode = element.firstChild;
  if (textNode instanceof Text) {
    textNode.data = text;
    return;
  }

  element.textContent = text;
}
