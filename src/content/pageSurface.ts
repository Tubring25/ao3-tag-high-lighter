export type PageSurface = "light" | "dark";

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

// Below ~0.18 luminance, light text out-contrasts dark text (WCAG midpoint).
const DARK_BACKGROUND_MAX_LUMINANCE = 0.18;
const LIGHT_TEXT_MIN_LUMINANCE = 0.5;
const OPAQUE_ALPHA_THRESHOLD = 0.5;

/**
 * AO3 site skins (e.g. Reversi) are user-authored CSS with no marker class,
 * so we infer the page surface from the computed body/html background,
 * falling back to the body text color when both backgrounds are transparent.
 */
export function detectPageSurface(doc: Document = document): PageSurface {
  const view = doc.defaultView;
  if (!view) return "light";

  for (const element of [doc.body, doc.documentElement]) {
    if (!element) continue;
    const background = parseCssColor(view.getComputedStyle(element).backgroundColor);
    if (background && background.a >= OPAQUE_ALPHA_THRESHOLD) {
      return relativeLuminance(background) < DARK_BACKGROUND_MAX_LUMINANCE ? "dark" : "light";
    }
  }

  const text = doc.body ? parseCssColor(view.getComputedStyle(doc.body).color) : null;
  if (text && text.a >= OPAQUE_ALPHA_THRESHOLD && relativeLuminance(text) > LIGHT_TEXT_MIN_LUMINANCE) {
    return "dark";
  }

  return "light";
}

export function syncPageSurface(doc: Document = document): PageSurface {
  const surface = detectPageSurface(doc);
  if (surface === "dark") {
    doc.documentElement.dataset.ao3thSurface = "dark";
  } else {
    delete doc.documentElement.dataset.ao3thSurface;
  }
  return surface;
}

export function parseCssColor(value: string | null | undefined): Rgba | null {
  const input = value?.trim().toLowerCase();
  if (!input) return null;
  if (input === "transparent") return { r: 0, g: 0, b: 0, a: 0 };

  const hex = input.match(/^#([0-9a-f]{3,8})$/);
  if (hex) return parseHexColor(hex[1]);

  const rgb = input.match(/^rgba?\(([^)]+)\)$/);
  if (!rgb) return null;

  const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;

  const [r, g, b] = parts.slice(0, 3).map(parseChannel);
  const a = parts[3] === undefined ? 1 : parseAlpha(parts[3]);
  if ([r, g, b, a].some((channel) => Number.isNaN(channel))) return null;

  return { r, g, b, a };
}

export function relativeLuminance({ r, g, b }: Pick<Rgba, "r" | "g" | "b">): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function parseHexColor(hex: string): Rgba | null {
  const expanded = hex.length <= 4 ? [...hex].map((digit) => digit + digit).join("") : hex;
  if (expanded.length !== 6 && expanded.length !== 8) return null;

  const channels = expanded.match(/../g)?.map((pair) => Number.parseInt(pair, 16));
  if (!channels) return null;

  const [r, g, b, alpha = 255] = channels;
  return { r, g, b, a: alpha / 255 };
}

function parseChannel(part: string): number {
  return part.endsWith("%") ? (Number.parseFloat(part) / 100) * 255 : Number.parseFloat(part);
}

function parseAlpha(part: string): number {
  return part.endsWith("%") ? Number.parseFloat(part) / 100 : Number.parseFloat(part);
}
