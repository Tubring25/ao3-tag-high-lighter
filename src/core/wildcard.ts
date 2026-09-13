export interface WildcardMatcher {
  test(value: string): boolean;
}

export function matchesWildcardPattern(pattern: string, value: string): boolean {
  return compileWildcardPattern(pattern).test(value);
}

export function compileWildcardPattern(pattern: string): WildcardMatcher {
  const parts = pattern.split("*");
  if (parts.length === 1) return { test: (value) => value === pattern };
  const prefix = parts[0];
  const suffix = parts[parts.length - 1];
  const middle = parts.slice(1, -1).filter(Boolean).map((text) => ({ text, table: buildTable(text) }));
  return {
    test(value) {
      if (!value.startsWith(prefix) || !value.endsWith(suffix)) return false;
      let cursor = prefix.length;
      const end = value.length - suffix.length;
      if (cursor > end) return false;
      for (const { text, table } of middle) {
        const found = findLiteral(value, text, table, cursor, end);
        if (found < 0 || hasLineTerminator(value, cursor, found)) return false;
        cursor = found + text.length;
      }
      return !hasLineTerminator(value, cursor, end);
    },
  };
}

function buildTable(text: string): number[] {
  const table = new Array<number>(text.length).fill(0);
  let matched = 0;
  for (let index = 1; index < text.length; index++) {
    while (matched > 0 && text[index] !== text[matched]) matched = table[matched - 1];
    if (text[index] === text[matched]) matched++;
    table[index] = matched;
  }
  return table;
}

function findLiteral(value: string, text: string, table: readonly number[], start: number, end: number): number {
  let matched = 0;
  for (let index = start; index < end; index++) {
    while (matched > 0 && value[index] !== text[matched]) matched = table[matched - 1];
    if (value[index] === text[matched]) matched++;
    if (matched === text.length) return index - text.length + 1;
  }
  return -1;
}

function hasLineTerminator(value: string, start: number, end: number): boolean {
  for (let index = start; index < end; index++) {
    const character = value.charCodeAt(index);
    if (character === 10 || character === 13 || character === 0x2028 || character === 0x2029) return true;
  }
  return false;
}
