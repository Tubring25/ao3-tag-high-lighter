import { compileWildcardPattern, matchesWildcardPattern } from "./wildcard";

function legacyMatch(pattern: string, value: string): boolean {
  return new RegExp("^" + pattern.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$").test(value);
}

describe("wildcard compatibility and complexity", () => {
  it.each([
    ["", "", true], ["*", "", true], ["a**b", "ab", true],
    ["a*b", "aXXb", true], ["a*b", "aXXbc", false],
    ["?", "a", false], ["?", "?", true], ["[a].+", "[a].+", true],
    ["A*", "abc", false], ["*", "😀", true], ["*", "a\nb", false],
    ["a", "a\n", false], ["*\n*", "a\nb", true], ["*ab*ab", "ab", false],
  ])("matches %j against %j", (pattern, value, expected) => {
    expect(matchesWildcardPattern(pattern, value)).toBe(expected);
  });

  it("agrees with the previous implementation over exhaustive short inputs", () => {
    const strings = [""];
    let layer = [""];
    for (let length = 1; length <= 3; length++) {
      layer = layer.flatMap((prefix) => ["a", "*", "?", "\n", "\r", "\u2028"].map((letter) => prefix + letter));
      strings.push(...layer);
    }
    for (const pattern of strings) {
      const matcher = compileWildcardPattern(pattern);
      for (const value of strings) expect(matcher.test(value)).toBe(legacyMatch(pattern, value));
    }
  });

  it("finishes adversarial many-star and long-literal inputs without backtracking", () => {
    const start = performance.now();
    expect(matchesWildcardPattern("*a".repeat(20000) + "b*", "a".repeat(100000))).toBe(false);
    expect(matchesWildcardPattern("*" + "a".repeat(20000) + "b*", "a".repeat(200000))).toBe(false);
    expect(matchesWildcardPattern("*a".repeat(20000) + "*", "a".repeat(100000))).toBe(true);
    expect(performance.now() - start).toBeLessThan(1500);
  });
});
