#!/usr/bin/env node
// Refresh the AO3 page and skin fixtures used by the Playwright suite.
//
//   node e2e/scripts/capture-fixtures.mjs
//
// Pages keep AO3's real markup and tags (what the extension parses and
// matches) but replace creative content and identities with placeholders,
// so no one else's writing is stored in this repo.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const AO3 = "https://archiveofourown.org";
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

const PAGES = {
  "tag-works.html": "/tags/Alternate%20Universe%20-%20No%20Voldemort%20(Harry%20Potter)/works",
  "work.html": "/works/94339886",
};

const SKINS = {
  "ao3-default.css": { stylesheet: "/stylesheets/skins/skin_1_default/1_site_screen_.css" },
  "reversi.css": { skinPage: "/skins/929" },
};

async function fetchText(path, attempts = 3) {
  const response = await fetch(AO3 + path, { headers: { "User-Agent": "ao3-tag-highlighter-fixture-capture" } });
  if (response.ok) return response.text();
  // AO3 sits behind Cloudflare and occasionally returns transient 5xx.
  if (response.status >= 500 && attempts > 1) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return fetchText(path, attempts - 1);
  }
  throw new Error(`${path}: HTTP ${response.status}`);
}

function sanitizePage(html) {
  const { document } = new JSDOM(html).window;
  const placeholder = (text) => {
    const p = document.createElement("p");
    p.textContent = text;
    return p;
  };

  document.querySelectorAll("script, noscript, iframe, #kudos, #comments_placeholder, #feedback .comment").forEach((el) => el.remove());
  document.querySelectorAll("input[name=authenticity_token]").forEach((el) => el.setAttribute("value", "fixture"));
  document.querySelectorAll("img").forEach((el) => el.removeAttribute("src"));

  // Identities: authors, gift recipients, commenters.
  document.querySelectorAll('a[href^="/users/"]').forEach((el) => {
    el.textContent = "fixture_user";
    el.setAttribute("href", "/users/fixture_user");
  });

  // Creative content: titles, summaries, notes, chapter text.
  document.querySelectorAll("li.work.blurb").forEach((blurb, index) => {
    const title = blurb.querySelector('h4.heading a[href^="/works/"]');
    if (title) title.textContent = `Fixture Work ${index + 1}`;
  });
  document.querySelectorAll('h4.heading a[href^="/series/"], ul.series a').forEach((el) => {
    el.textContent = "Fixture Series";
  });
  document.querySelectorAll("h2.title.heading").forEach((el) => {
    el.textContent = "Fixture Work";
  });
  document.querySelectorAll("h3.title, .chapter .title").forEach((el) => {
    el.textContent = "Chapter";
  });
  document.querySelectorAll(".userstuff").forEach((el) => {
    el.replaceChildren(
      placeholder("Placeholder text standing in for the author's writing. It keeps paragraph layout realistic."),
      placeholder("A second placeholder paragraph so contrast checks see body text on the page surface.")
    );
  });

  return "<!DOCTYPE html>\n" + document.documentElement.outerHTML + "\n";
}

async function captureSkin({ stylesheet, skinPage }) {
  if (stylesheet) return fetchText(stylesheet);

  const { document } = new JSDOM(await fetchText(skinPage)).window;
  // The skin page shows the description and the CSS in separate <pre> blocks.
  const css = [...document.querySelectorAll("blockquote pre")]
    .map((pre) => pre.textContent ?? "")
    .find((text) => /\{[^}]*:[^}]*\}/.test(text));
  if (!css) throw new Error(`${skinPage}: skin CSS block not found`);
  return css;
}

async function main() {
  await mkdir(join(FIXTURES, "pages"), { recursive: true });
  await mkdir(join(FIXTURES, "skins"), { recursive: true });

  for (const [file, path] of Object.entries(PAGES)) {
    await writeFile(join(FIXTURES, "pages", file), sanitizePage(await fetchText(path)));
    console.log(`✓ pages/${file}`);
  }

  for (const [file, source] of Object.entries(SKINS)) {
    await writeFile(join(FIXTURES, "skins", file), await captureSkin(source));
    console.log(`✓ skins/${file}`);
  }
}

await main();
