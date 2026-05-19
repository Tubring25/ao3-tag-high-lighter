import type { HideWorkMode, MatchResult, ParsedWork, RuleAction, TagMatch } from "../core/types";
import { resolveHighestPriorityAction } from "../core/priority";
import { applyWorkEffects, clearWorkEffects } from "./workEffects";

export interface RenderOptions {
  hideWorkMode?: HideWorkMode;
}

interface TagRenderState {
  actions: RuleAction[];
  ruleIds: string[];
}

export function renderMatches(
  works: readonly ParsedWork[],
  matchResult: MatchResult,
  options: RenderOptions = {}
): void {
  const hideWorkMode = options.hideWorkMode ?? "collapse";
  const collapsedWorkIds = new Set(
    matchResult.workSummaries
      .filter((summary) => summary.hasHideWork && hideWorkMode === "collapse")
      .map((summary) => summary.workId)
  );

  clearRenderedMatches(works, { preserveCollapseWorkIds: collapsedWorkIds });

  const tagsById = mapTagsById(works);
  const tagStates = groupTagMatches(matchResult.tagMatches);

  for (const [tagId, state] of tagStates) {
    const tag = tagsById.get(tagId);
    if (!tag) continue;

    const action = resolveHighestPriorityAction(state.actions);
    if (!action) continue;

    tag.element.dataset.ao3thAction = action;
    tag.element.dataset.ao3thRuleIds = state.ruleIds.join(",");
  }

  const worksById = new Map(works.map((work) => [work.id, work]));
  for (const summary of matchResult.workSummaries) {
    const work = worksById.get(summary.workId);
    if (!work) continue;

    applyWorkEffects(work, summary, { hideWorkMode });
  }
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
  const tagsById = new Map<string, ParsedWork["tags"][number]>();

  for (const work of works) {
    for (const tag of work.tags) {
      tagsById.set(tag.id, tag);
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
