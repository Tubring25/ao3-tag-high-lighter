import type {
  HideWorkMode,
  MatchResult,
  ParsedWork,
  RuleAction,
  RuleActionStyles,
  TagMatch,
} from "../core/types";
import { DEFAULT_ACTION_STYLES } from "../core/actionStyles";
import { resolveHighestPriorityAction } from "../core/priority";
import { applyWorkEffects, clearWorkEffects } from "./workEffects";

export interface RenderOptions {
  hideWorkMode?: HideWorkMode;
  actionStyles?: RuleActionStyles;
}

interface TagRenderState {
  actions: RuleAction[];
  ruleIds: string[];
}

interface MatchedTagTextsByAction {
  hideWork: Map<string, string[]>;
  warn: Map<string, string[]>;
}

export function renderMatches(
  works: readonly ParsedWork[],
  matchResult: MatchResult,
  options: RenderOptions = {}
): void {
  const hideWorkMode = options.hideWorkMode ?? "collapse";
  const actionStyles = options.actionStyles ?? DEFAULT_ACTION_STYLES;
  applyActionStyleVariables(actionStyles);
  const detailWorkIds = new Set(
    works.filter((work) => work.isWorkDetailPage).map((work) => work.id)
  );
  const collapsedWorkIds = new Set(
    matchResult.workSummaries
      .filter(
        (summary) =>
          summary.hasHideWork && hideWorkMode === "collapse" && !detailWorkIds.has(summary.workId)
      )
      .map((summary) => summary.workId)
  );

  clearRenderedMatches(works, { preserveCollapseWorkIds: collapsedWorkIds });

  const tagsById = mapTagsById(works);
  const tagStates = groupTagMatches(matchResult.tagMatches);
  const matchedTagTexts = mapMatchedTagTextsByAction(matchResult.tagMatches, tagsById);

  for (const [tagId, state] of tagStates) {
    const item = tagsById.get(tagId);
    if (!item) continue;

    const action = resolveHighestPriorityAction(state.actions);
    if (!action) continue;

    item.tag.element.dataset.ao3thAction = action;
    item.tag.element.dataset.ao3thRuleIds = state.ruleIds.join(",");
  }

  const worksById = new Map(works.map((work) => [work.id, work]));
  for (const summary of matchResult.workSummaries) {
    const work = worksById.get(summary.workId);
    if (!work) continue;

    applyWorkEffects(work, summary, {
      hideWorkMode,
      collapseReasons: matchedTagTexts.hideWork.get(summary.workId) ?? [],
      warningReasons: matchedTagTexts.warn.get(summary.workId) ?? [],
    });
  }
}

function applyActionStyleVariables(actionStyles: RuleActionStyles): void {
  document.documentElement.style.setProperty(
    "--ao3th-highlight-bg",
    actionStyles.highlight.backgroundColor
  );
  document.documentElement.style.setProperty(
    "--ao3th-highlight-text",
    actionStyles.highlight.textColor
  );
  document.documentElement.style.setProperty("--ao3th-warn-bg", actionStyles.warn.backgroundColor);
  document.documentElement.style.setProperty("--ao3th-warn-text", actionStyles.warn.textColor);
}

interface ClearRenderOptions {
  preserveCollapseWorkIds?: ReadonlySet<string>;
}

export function clearRenderedMatches(
  works: readonly ParsedWork[],
  options: ClearRenderOptions = {}
): void {
  for (const work of works) {
    for (const tag of work.tags) {
      delete tag.element.dataset.ao3thAction;
      delete tag.element.dataset.ao3thRuleIds;
    }

    clearWorkEffects(work, {
      preserveCollapseState: options.preserveCollapseWorkIds?.has(work.id) ?? false,
    });
  }
}

function mapTagsById(works: readonly ParsedWork[]) {
  const tagsById = new Map<string, { tag: ParsedWork["tags"][number]; work: ParsedWork }>();

  for (const work of works) {
    for (const tag of work.tags) {
      tagsById.set(tag.id, { tag, work });
    }
  }

  return tagsById;
}

function groupTagMatches(matches: readonly TagMatch[]) {
  const states = new Map<string, TagRenderState>();

  for (const match of matches) {
    const state = states.get(match.tagId) ?? { actions: [], ruleIds: [] };
    state.actions.push(match.action);
    state.ruleIds.push(match.ruleId);
    states.set(match.tagId, state);
  }

  return states;
}

function mapMatchedTagTextsByAction(
  matches: readonly TagMatch[],
  tagsById: Map<string, { tag: ParsedWork["tags"][number]; work: ParsedWork }>
): MatchedTagTextsByAction {
  const textsByAction: MatchedTagTextsByAction = {
    hideWork: new Map<string, string[]>(),
    warn: new Map<string, string[]>(),
  };

  for (const match of matches) {
    if (match.action !== "hideWork" && match.action !== "warn") continue;

    const item = tagsById.get(match.tagId);
    if (!item) continue;

    const textsByWork = textsByAction[match.action];
    const texts = textsByWork.get(item.work.id) ?? [];
    if (!texts.includes(item.tag.text)) texts.push(item.tag.text);
    textsByWork.set(item.work.id, texts);
  }

  return textsByAction;
}
