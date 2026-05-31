import type { HideWorkMode, ParsedWork, WorkMatchSummary } from "../core/types";

const PLACEHOLDER_SELECTOR = "[data-ao3th-collapse-placeholder]";

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

  if (!options.preserveCollapseState) {
    delete work.element.dataset.ao3thExpanded;
    work.element.querySelector(PLACEHOLDER_SELECTOR)?.remove();
  }
}

function ensureCollapsePlaceholder(workElement: HTMLElement): void {
  if (workElement.querySelector(PLACEHOLDER_SELECTOR)) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ao3th-collapse-placeholder";
  button.dataset.ao3thCollapsePlaceholder = "true";
  button.textContent = "This work is collapsed by AO3 Tag Highlighter. Click to show.";
  button.addEventListener("click", () => {
    const expanded = workElement.dataset.ao3thExpanded === "true";

    if (expanded) {
      delete workElement.dataset.ao3thExpanded;
      button.textContent = "This work is collapsed by AO3 Tag Highlighter. Click to show.";
      return;
    }

    workElement.dataset.ao3thExpanded = "true";
    button.textContent = "Hide again";
  });

  workElement.prepend(button);
}
