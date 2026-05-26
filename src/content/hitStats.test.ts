import type { MatchResult } from "../core/types";
import { calculateHitStats } from "./hitStats";

describe("calculateHitStats", () => {
  it("returns zero counts for an empty match result", () => {
    expect(calculateHitStats(createMatchResult(), 3)).toEqual({
      highlight: 0,
      warn: 0,
      mute: 0,
      hideWork: 0,
      totalRules: 3,
    });
  });

  it("counts highlight and mute tag outcomes", () => {
    const stats = calculateHitStats(
      createMatchResult({
        tagMatches: [
          { tagId: "tag-1", ruleId: "rule-1", action: "highlight" },
          { tagId: "tag-2", ruleId: "rule-2", action: "mute" },
        ],
      }),
      2
    );

    expect(stats.highlight).toBe(1);
    expect(stats.mute).toBe(1);
  });

  it("counts only the highest-priority action for multiple matches on the same tag", () => {
    const stats = calculateHitStats(
      createMatchResult({
        tagMatches: [
          { tagId: "tag-1", ruleId: "rule-mute", action: "mute" },
          { tagId: "tag-1", ruleId: "rule-highlight", action: "highlight" },
          { tagId: "tag-2", ruleId: "rule-highlight-2", action: "highlight" },
        ],
      }),
      3
    );

    expect(stats.highlight).toBe(2);
    expect(stats.mute).toBe(0);
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
});

function createMatchResult(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    tagMatches: [],
    workSummaries: [],
    ...overrides,
  };
}
