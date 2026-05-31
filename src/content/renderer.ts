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

  for (const [tagId, state] of tagStates) {
    const item = tagsById.get(tagId);
    if (!item) continue;

    const effectiveActions = item.work.isWorkDetailPage
      ? state.actions.filter((action) => action !== "hideWork")
      : state.actions;
    const action = resolveHighestPriorityAction(effectiveActions);
    if (!action) continue;

    item.tag.element.dataset.ao3thAction = action;
    item.tag.element.dataset.ao3thRuleIds = state.ruleIds.join(",");
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
