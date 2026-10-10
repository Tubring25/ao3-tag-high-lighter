import { afterEach, describe, expect, it } from "vitest";
import css from "../styles/content.css?raw";
import { detectPageSurface, parseCssColor, relativeLuminance, syncPageSurface } from "./pageSurface";

afterEach(() => {
  document.body.removeAttribute("style");
  document.documentElement.removeAttribute("style");
  delete document.documentElement.dataset.ao3thSurface;
});

describe("parseCssColor", () => {
  it("parses computed rgb and rgba values", () => {
    expect(parseCssColor("rgb(51, 51, 51)")).toEqual({ r: 51, g: 51, b: 51, a: 1 });
    expect(parseCssColor("rgba(0, 0, 0, 0)")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(parseCssColor("rgb(255 255 255 / 50%)")).toEqual({ r: 255, g: 255, b: 255, a: 0.5 });
  });

  it("parses hex and transparent values", () => {
    expect(parseCssColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseCssColor("#33333300")).toEqual({ r: 51, g: 51, b: 51, a: 0 });
    expect(parseCssColor("transparent")?.a).toBe(0);
  });

  it("returns null for empty or unsupported values", () => {
    expect(parseCssColor("")).toBeNull();
    expect(parseCssColor(undefined)).toBeNull();
    expect(parseCssColor("hsl(0 0% 20%)")).toBeNull();
  });
});

describe("relativeLuminance", () => {
  it("spans 0 for black to 1 for white", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1);
  });
});

describe("detectPageSurface", () => {
  it("treats the AO3 Reversi body background as dark", () => {
    document.body.style.backgroundColor = "#333333";
    expect(detectPageSurface(document)).toBe("dark");
  });

  it("treats the AO3 default white background as light", () => {
    document.body.style.backgroundColor = "#ffffff";
    expect(detectPageSurface(document)).toBe("light");
  });

  it("treats light tinted skins as light", () => {
    document.body.style.backgroundColor = "#f5f0e8";
    expect(detectPageSurface(document)).toBe("light");
  });

  it("falls back to the html background when the body is transparent", () => {
    document.body.style.backgroundColor = "transparent";
    document.documentElement.style.backgroundColor = "rgb(20, 20, 20)";
    expect(detectPageSurface(document)).toBe("dark");
  });

  it("falls back to light body text when both backgrounds are transparent", () => {
    document.body.style.color = "#dddddd";
    expect(detectPageSurface(document)).toBe("dark");
  });

  it("defaults to light when nothing indicates a dark skin", () => {
    expect(detectPageSurface(document)).toBe("light");
  });
});

describe("syncPageSurface", () => {
  it("marks the root element on dark pages and clears it on light pages", () => {
    document.body.style.backgroundColor = "#333333";
    syncPageSurface(document);
    expect(document.documentElement.dataset.ao3thSurface).toBe("dark");

    document.body.style.backgroundColor = "#ffffff";
    syncPageSurface(document);
    expect(document.documentElement.dataset.ao3thSurface).toBeUndefined();
  });
});

describe("content.css skin compatibility", () => {
  it("never paints the matched work card background", () => {
    const blurbRule = css.match(/li\.work\.blurb\[data-ao3th-rule-ids\]\s*\{([^}]*)\}/);
    expect(blurbRule?.[1]).toBeDefined();
    expect(blurbRule?.[1]).not.toMatch(/background/);
  });

  it("defines a dark override for every themed variable", () => {
    const block = (selector: string) => {
      const escaped = selector.replace(/[[\]"=]/g, "\\$&");
      const body = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
      return [...body.matchAll(/(--ao3th-[\w-]+):/g)].map((match) => match[1]).sort();
    };

    const lightVars = block(":root");
    expect(lightVars.length).toBeGreaterThan(0);
    expect(block(':root[data-ao3th-surface="dark"]')).toEqual(lightVars);
  });
});
