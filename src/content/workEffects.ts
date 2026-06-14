import type { HideWorkMode, ParsedWork, WorkMatchSummary } from "../core/types";
import { t } from "../shared/i18n";

const PLACEHOLDER_SELECTOR = "[data-ao3th-collapse-placeholder]";
const WARN_BANNER_SELECTOR = "[data-ao3th-warn-banner]";
const CAUTION_BANNER_SELECTOR = "[data-ao3th-caution-banner]";
const WARNING_BAR_MAX_TAGS = 4;

interface WorkEffectOptions {
  hideWorkMode: HideWorkMode;
  collapseReasons?: readonly string[];
  warningReasons?: readonly string[];
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
    if ((options.warningReasons?.length ?? 0) <= WARNING_BAR_MAX_TAGS) {
      if (work.isWorkDetailPage) {
        ensureDetailWarningBar(work, options.warningReasons ?? []);
      } else {
        ensureWarnBanner(work.element);
      }
    }
  }

  if (!summary.hasHideWork) return;

  if (work.isWorkDetailPage) {
    ensureDetailCautionBar(work, options.collapseReasons ?? []);
    return;
  }

  if (options.hideWorkMode === "hide") {
    work.element.dataset.ao3thHidden = "hide";
    work.element.hidden = true;
    return;
  }

  work.element.dataset.ao3thHidden = "collapse";
  work.element.hidden = false;
  ensureCollapsePlaceholder(work.element, options.collapseReasons ?? []);
}

export function clearWorkEffects(work: ParsedWork, options: ClearWorkEffectOptions = {}): void {
  delete work.element.dataset.ao3thWarn;
  delete work.element.dataset.ao3thHidden;
  delete work.element.dataset.ao3thRuleIds;
  work.element.hidden = false;
  work.element.querySelector(WARN_BANNER_SELECTOR)?.remove();
  work.element.querySelector(CAUTION_BANNER_SELECTOR)?.remove();

  const detailMeta = findDetailMetaElement(work);
  detailMeta?.querySelector(WARN_BANNER_SELECTOR)?.remove();
  detailMeta?.querySelector(CAUTION_BANNER_SELECTOR)?.remove();

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
  banner.textContent = t("contentWarnBanner");

  const title = workElement.querySelector("h4.heading, h4");
  if (title?.parentElement === workElement) {
    title.insertAdjacentElement("afterend", banner);
    return;
  }

  workElement.prepend(banner);
}

function ensureDetailWarningBar(work: ParsedWork, reasons: readonly string[]): void {
  const metaElement = findDetailMetaElement(work);
  if (!metaElement || metaElement.querySelector(WARN_BANNER_SELECTOR)) return;

  const banner = createDetailBar({
    className: "ao3th-detail-warning-bar",
    dataName: "ao3thWarnBanner",
    text: buildWarningMessage(reasons),
  });
  metaElement.prepend(banner);
}

function ensureDetailCautionBar(work: ParsedWork, reasons: readonly string[]): void {
  const metaElement = findDetailMetaElement(work);
  if (!metaElement || metaElement.querySelector(CAUTION_BANNER_SELECTOR)) return;

  const banner = createDetailBar({
    className: "ao3th-detail-caution-bar",
    dataName: "ao3thCautionBanner",
    text: buildCautionMessage(reasons),
  });
  const warningBar = metaElement.querySelector(WARN_BANNER_SELECTOR);
  warningBar?.insertAdjacentElement("afterend", banner) ?? metaElement.prepend(banner);
}

interface DetailBarOptions {
  className: string;
  dataName: "ao3thWarnBanner" | "ao3thCautionBanner";
  text: string;
}

function createDetailBar(options: DetailBarOptions): HTMLDivElement {
  const banner = document.createElement("div");
  banner.className = options.className;
  banner.dataset[options.dataName] = "true";
  banner.textContent = options.text;
  return banner;
}

function findDetailMetaElement(work: ParsedWork): HTMLElement | null {
  for (const tag of work.tags) {
    const metaElement = tag.element.closest<HTMLElement>("dl.work.meta");
    if (metaElement) return metaElement;
  }

  return work.element.querySelector<HTMLElement>("dl.work.meta");
}

function buildWarningMessage(reasons: readonly string[]): string {
  if (reasons.length === 0) return t("contentWarnBanner");
  return t("contentWarningMessage", [reasons.join(", ")]);
}

function buildCautionMessage(reasons: readonly string[]): string {
  if (reasons.length === 0) return t("contentCautionNoReasons");
  return t("contentCautionMessage", [reasons.join(", ")]);
}

function ensureCollapsePlaceholder(workElement: HTMLElement, reasons: readonly string[]): void {
  const existing = workElement.querySelector<HTMLButtonElement>(PLACEHOLDER_SELECTOR);
  if (existing) {
    setCollapseReasons(existing, reasons);
    renderCollapsePlaceholder(existing, workElement.dataset.ao3thExpanded === "true");
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ao3th-collapse-placeholder";
  button.dataset.ao3thCollapsePlaceholder = "true";
  setCollapseReasons(button, reasons);
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
    expanded
      ? t("contentCollapsedExpanded")
      : buildCollapsedMessage(getCollapseReasons(button))
  );

  const action = getOrCreatePlaceholderPart(button, "ao3th-collapse-action");
  setTextWithoutChildMutation(action, expanded ? t("contentHideAgain") : t("contentClickToExpand"));
}

function buildCollapsedMessage(reasons: readonly string[]): string {
  if (reasons.length === 0) return t("contentCollapsedNoReasons");
  if (reasons.length === 1) return t("contentCollapsedOneReason", [reasons[0]]);
  return t("contentCollapsedMultipleReasons", [reasons.join(", ")]);
}

function setCollapseReasons(button: HTMLButtonElement, reasons: readonly string[]): void {
  button.dataset.ao3thCollapseReasons = JSON.stringify([...new Set(reasons)]);
}

function getCollapseReasons(button: HTMLButtonElement): string[] {
  const raw = button.dataset.ao3thCollapseReasons;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
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
