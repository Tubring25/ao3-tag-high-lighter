import { describe, expect, it } from "vitest";
import { DEFAULT_ACTION_STYLES } from "../core/actionStyles";
import css from "./content.css?raw";

// content.css shares the light DOM with arbitrary AO3 site skins (BUG-002:
// a hard-coded white card made Reversi text invisible). These guards keep
// every extension color behind a themed variable with a dark-skin override.

const LIGHT_ROOT = ":root";
const DARK_ROOT = ':root[data-ao3th-surface="dark"]';

// Set at runtime from the user's chosen action styles (renderer.ts); the CSS
// fallback is the only place a literal color may appear outside the root blocks.
const USER_STYLE_FALLBACKS: Record<string, string> = {
  "--ao3th-highlight-bg": DEFAULT_ACTION_STYLES.highlight.backgroundColor,
  "--ao3th-highlight-text": DEFAULT_ACTION_STYLES.highlight.textColor,
  "--ao3th-warn-bg": DEFAULT_ACTION_STYLES.warn.backgroundColor,
  "--ao3th-warn-text": DEFAULT_ACTION_STYLES.warn.textColor,
};

const COLOR_LITERAL =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|\b(?:white|black|gray|grey|silver|red|maroon|orange|yellow|green|teal|blue|navy|purple|pink|brown|beige|ivory|whitesmoke|gainsboro)\b/i;

interface Declaration {
  selector: string;
  property: string;
  value: string;
}

const declarations = parseDeclarations(css);

describe("content.css skin compatibility", () => {
  it("never paints the matched work card background", () => {
    const cardDeclarations = declarations.filter(
      (declaration) => declaration.selector === "li.work.blurb[data-ao3th-rule-ids]"
    );
    expect(cardDeclarations.length).toBeGreaterThan(0);
    expect(cardDeclarations.map((declaration) => declaration.property)).not.toContain("background");
    expect(cardDeclarations.map((declaration) => declaration.property)).not.toContain("background-color");
  });

  it("keeps literal colors inside the themed root blocks", () => {
    const offenders = declarations
      .filter((declaration) => declaration.selector !== LIGHT_ROOT && declaration.selector !== DARK_ROOT)
      .filter((declaration) => COLOR_LITERAL.test(stripUserStyleFallbacks(declaration.value)))
      .map((declaration) => `${declaration.selector} { ${declaration.property}: ${declaration.value} }`);

    expect(offenders).toEqual([]);
  });

  it("keeps user style fallbacks in sync with the default action styles", () => {
    const mismatches = [...css.matchAll(/var\((--ao3th-(?:highlight|warn)-(?:bg|text))\s*,\s*([^)]+)\)/g)]
      .filter(([, name, fallback]) => fallback.trim().toLowerCase() !== USER_STYLE_FALLBACKS[name]?.toLowerCase())
      .map(([usage]) => usage);

    expect(mismatches).toEqual([]);
  });

  it("defines a dark override for every themed variable", () => {
    const lightVariables = rootVariables(LIGHT_ROOT);
    expect(lightVariables.length).toBeGreaterThan(0);
    expect(rootVariables(DARK_ROOT)).toEqual(lightVariables);
  });

  it("only references themed variables that are defined", () => {
    const defined = new Set([...rootVariables(LIGHT_ROOT), ...Object.keys(USER_STYLE_FALLBACKS)]);
    const undefinedReferences = [...css.matchAll(/var\((--ao3th-[\w-]+)/g)]
      .map(([, name]) => name)
      .filter((name) => !defined.has(name));

    expect([...new Set(undefinedReferences)]).toEqual([]);
  });
});

function parseDeclarations(source: string): Declaration[] {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const result: Declaration[] = [];

  for (const [, rawSelector, body] of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rawSelector.trim().replace(/\s+/g, " ");
    for (const rawDeclaration of body.split(";")) {
      const separator = rawDeclaration.indexOf(":");
      if (separator === -1) continue;
      result.push({
        selector,
        property: rawDeclaration.slice(0, separator).trim().toLowerCase(),
        value: rawDeclaration.slice(separator + 1).trim(),
      });
    }
  }

  return result;
}

function rootVariables(selector: string): string[] {
  return declarations
    .filter((declaration) => declaration.selector === selector && declaration.property.startsWith("--ao3th-"))
    .map((declaration) => declaration.property)
    .sort();
}

function stripUserStyleFallbacks(value: string): string {
  return value.replace(/var\(--ao3th-(?:highlight|warn)-(?:bg|text)\s*,\s*[^)]+\)/g, "");
}
