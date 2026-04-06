import type { ParsedTag, ParsedTagCategory, ParsedWork } from "../core/types";
import { normalizeTagText } from "../core/normalize";

const LISTING_CATEGORY_MAP: Record<string, ParsedTagCategory> = {
  relationships: "relationship",
  characters: "character",
  freeforms: "freeform",
};

const DETAIL_CATEGORY_MAP: Record<string, ParsedTagCategory> = {
  relationship: "relationship",
  character: "character",
  freeform: "freeform",
};

export function parseAo3Works(root: ParentNode): ParsedWork[] {
  const listingWorks = parseListingPage(root);
  if (listingWorks.length > 0) return listingWorks;

  return parseWorkDetailPage(root);
}

function parseListingPage(root: ParentNode): ParsedWork[] {
  const workElements = root.querySelectorAll<HTMLElement>("li.work.blurb");
  const works: ParsedWork[] = [];

  for (const workEl of workElements) {
    const workId = workEl.id;
    if (!workId) continue;

    const tags: ParsedTag[] = [];
    const tagList = workEl.querySelector("ul.tags");
    if (!tagList) continue;

    const categoryCounters: Record<string, number> = {};

    for (const li of tagList.querySelectorAll<HTMLElement>("li")) {
      const category = detectListingCategory(li);
      if (!category) continue;

      const anchor = li.querySelector<HTMLElement>("a.tag");
      if (!anchor) continue;

      const text = anchor.textContent?.trim() ?? "";
      if (!text) continue;

      const count = categoryCounters[category] ?? 0;
      categoryCounters[category] = count + 1;

      tags.push({
        id: `${workId}:${category}:${count}`,
        text,
        normalizedText: normalizeTagText(text),
        category,
        element: anchor,
        workId,
      });
    }

    works.push({ id: workId, element: workEl, tags });
  }

  return works;
}

function parseWorkDetailPage(root: ParentNode): ParsedWork[] {
  const workskin = root.querySelector<HTMLElement>("#workskin");
  if (!workskin) return [];

  const metaDl = root.querySelector("dl.work.meta");
  if (!metaDl) return [];

  const workId = workskin.id;
  const tags: ParsedTag[] = [];
  const categoryCounters: Record<string, number> = {};

  for (const dd of metaDl.querySelectorAll<HTMLElement>("dd")) {
    const category = detectDetailCategory(dd);
    if (!category) continue;

    for (const anchor of dd.querySelectorAll<HTMLElement>("a.tag")) {
      const text = anchor.textContent?.trim() ?? "";
      if (!text) continue;

      const count = categoryCounters[category] ?? 0;
      categoryCounters[category] = count + 1;

      tags.push({
        id: `${workId}:${category}:${count}`,
        text,
        normalizedText: normalizeTagText(text),
        category,
        element: anchor,
        workId,
      });
    }
  }

  return [{ id: workId, element: workskin, tags }];
}

function detectListingCategory(li: HTMLElement): ParsedTagCategory | null {
  for (const [className, category] of Object.entries(LISTING_CATEGORY_MAP)) {
    if (li.classList.contains(className)) return category;
  }
  return null;
}

function detectDetailCategory(dd: HTMLElement): ParsedTagCategory | null {
  for (const [keyword, category] of Object.entries(DETAIL_CATEGORY_MAP)) {
    if (dd.classList.contains(keyword)) return category;
  }
  return null;
}
