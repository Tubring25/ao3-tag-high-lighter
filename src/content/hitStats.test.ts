import type { MatchResult, ParsedTag, ParsedWork } from "../core/types";
import { calculateHitStats } from "./hitStats";

describe("calculateHitStats", () => {
  it("returns zero counts for an empty match result", () => {
    expect(calculateHitStats(createMatchResult(), 3)).toEqual({
      highlight: 0,
      warn: 0,
      hideWork: 0,
      totalRules: 3,
    });
  });

  it("counts highlight tag outcomes", () => {
    const stats = calculateHitStats(
      createMatchResult({
        tagMatches: [
          { tagId: "tag-1", ruleId: "rule-1", action: "highlight" },
        ],
      }),
      1
    );

    expect(stats.highlight).toBe(1);
  });

  it("counts only the highest-priority action for multiple matches on the same tag", () => {
    const stats = calculateHitStats(
      createMatchResult({
        tagMatches: [
          { tagId: "tag-1", ruleId: "rule-highlight", action: "highlight" },
          { tagId: "tag-1", ruleId: "rule-warn", action: "warn" },
          { tagId: "tag-2", ruleId: "rule-highlight-2", action: "highlight" },
        ],
      }),
      3
    );

    expect(stats.highlight).toBe(1);
    expect(stats.warn).toBe(0);
  });

  it("counts warn and hideWork by matched work summaries", () => {
    const stats = calculateHitStats(
      createMatchResult({
        workSummaries: [
          {
            workId: "work-1",
            matchedRuleIds: ["rule-warn"],
            hasWarn: true,
            hasHideWork: false,
          },
          {
            workId: "work-2",
            matchedRuleIds: ["rule-warn", "rule-hide"],
            hasWarn: true,
            hasHideWork: true,
          },
        ],
      }),
      2
    );

    expect(stats.warn).toBe(2);
    expect(stats.hideWork).toBe(1);
  });

  it("does not count hideWork effects on work detail pages", () => {
    const work = createWork({ isWorkDetailPage: true });
    const stats = calculateHitStats(
      createMatchResult({
        tagMatches: [
          { tagId: "tag-1", ruleId: "rule-highlight", action: "highlight" },
          { tagId: "tag-1", ruleId: "rule-hide", action: "hideWork" },
        ],
        workSummaries: [
          {
            workId: "work-1",
            matchedRuleIds: ["rule-hide"],
            hasWarn: false,
            hasHideWork: true,
          },
        ],
      }),
      2,
      [work]
    );

    expect(stats.highlight).toBe(1);
    expect(stats.hideWork).toBe(0);
  });
});

function createMatchResult(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    tagMatches: [],
    workSummaries: [],
    ...overrides,
  };
}

function createWork(overrides: Partial<ParsedWork> = {}): ParsedWork {
  const element = document.createElement("article");
  const tagElement = document.createElement("a");
  const tag: ParsedTag = {
    id: "tag-1",
    text: "Slow Burn",
    normalizedText: "slow burn",
    category: "freeform",
    element: tagElement,
    workId: "work-1",
  };

  return {
    id: "work-1",
    element,
    tags: [tag],
    ...overrides,
  };
}
