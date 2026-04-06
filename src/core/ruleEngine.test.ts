import { matchRules } from "./ruleEngine";
import type { ParsedWork, Rule } from "./types";

function createTagElement(text: string): HTMLElement {
  const element = document.createElement("a");
  element.textContent = text;
  return element;
}

function createWork(overrides?: Partial<ParsedWork>): ParsedWork {
  const workElement = document.createElement("article");

  return {
    id: "work-1",
    element: workElement,
    tags: [
      {
        id: "tag-1",
        text: "Alpha/Beta",
        normalizedText: "alpha/beta",
        category: "relationship",
        element: createTagElement("Alpha/Beta"),
        workId: "work-1"
      },
      {
        id: "tag-2",
        text: "Slow Burn",
        normalizedText: "slow burn",
        category: "freeform",
        element: createTagElement("Slow Burn"),
        workId: "work-1"
      }
    ],
    ...overrides
  };
}

function createRule(overrides: Partial<Rule>): Rule {
  return {
    id: "rule-1",
    pattern: "Alpha/Beta",
    action: "highlight",
    matchMode: "exact",
    category: "all",
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  };
}

describe("matchRules", () => {
  it("matches exact rules against normalized tag text", () => {
    const result = matchRules([createWork()], [createRule({ pattern: "alpha/beta" })]);

    expect(result.tagMatches).toEqual([
      { tagId: "tag-1", ruleId: "rule-1", action: "highlight" }
    ]);
  });

  it("matches contains rules", () => {
    const result = matchRules(
      [createWork()],
      [createRule({ id: "rule-contains", pattern: "slow", matchMode: "contains" })]
    );

    expect(result.tagMatches).toEqual([
      { tagId: "tag-2", ruleId: "rule-contains", action: "highlight" }
    ]);
  });

  it("matches wildcard rules", () => {
    const result = matchRules(
      [createWork()],
      [createRule({ id: "rule-wildcard", pattern: "alpha*", matchMode: "wildcard" })]
    );

    expect(result.tagMatches).toEqual([
      { tagId: "tag-1", ruleId: "rule-wildcard", action: "highlight" }
    ]);
  });

  it("filters by category", () => {
    const result = matchRules(
      [createWork()],
      [createRule({ pattern: "slow burn", category: "relationship", matchMode: "exact" })]
    );

    expect(result.tagMatches).toEqual([]);
  });

  it("skips disabled rules", () => {
    const result = matchRules(
      [createWork()],
      [createRule({ enabled: false, pattern: "alpha/beta" })]
    );

    expect(result.tagMatches).toEqual([]);
  });
});
