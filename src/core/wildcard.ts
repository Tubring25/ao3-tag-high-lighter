export function matchesWildcardPattern(pattern: string, value: string): boolean {
  return compileWildcardPattern(pattern).test(value);
}

export function compileWildcardPattern(pattern: string): RegExp {
  return new RegExp("^" + pattern.split("*").map(escapeRegExp).join(".*") + "$");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
