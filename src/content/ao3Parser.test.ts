import { parseAo3Works } from "./ao3Parser";
import { matchRules } from "../core/ruleEngine";
import { renderMatches } from "./renderer";
import type { Rule } from "../core/types";
import searchResultsFixture from "../../examples/AGENTS.html?raw";

describe("parseAo3Works", () => {
  it("parses works and tags from an AO3 works listing fragment", () => {
    document.body.innerHTML = `
      <ol class="work index group">
        <li id="work_123" class="work blurb group">
          <ul class="tags commas">
            <li class="relationships">
              <a class="tag" href="/tags/Alpha*s*Beta/works">Alpha/Beta</a>
            </li>
            <li class="characters">
              <a class="tag" href="/tags/Alice/works">Alice</a>
            </li>
            <li class="freeforms">
              <a class="tag" href="/tags/Slow%20Burn/works">Slow Burn</a>
            </li>
          </ul>
        </li>
      </ol>
    `;

    expect(parseAo3Works(document)).toEqual([
      {
        id: "work_123",
        element: expect.any(HTMLElement),
        tags: [
          {
            id: "work_123:relationship:0",
            text: "Alpha/Beta",
            normalizedText: "alpha/beta",
            category: "relationship",
            element: expect.any(HTMLElement),
            workId: "work_123"
          },
          {
            id: "work_123:character:0",
            text: "Alice",
            normalizedText: "alice",
            category: "character",
            element: expect.any(HTMLElement),
            workId: "work_123"
          },
          {
            id: "work_123:freeform:0",
            text: "Slow Burn",
            normalizedText: "slow burn",
            category: "freeform",
            element: expect.any(HTMLElement),
            workId: "work_123"
          }
        ]
      }
    ]);
  });

  it("parses tags from a single work detail fragment", () => {
    window.history.pushState(null, "", "/works/12345");

    document.body.innerHTML = `
      <div id="workskin">
        <dl class="work meta group">
          <dd class="relationship tags">
            <ul class="commas">
              <li><a class="tag" href="/tags/Alpha*s*Beta/works">Alpha/Beta</a></li>
            </ul>
          </dd>
          <dd class="character tags">
            <ul class="commas">
              <li><a class="tag" href="/tags/Alice/works">Alice</a></li>
            </ul>
          </dd>
          <dd class="freeform tags">
            <ul class="commas">
              <li><a class="tag" href="/tags/Canon%20Divergence/works">Canon Divergence</a></li>
            </ul>
          </dd>
        </dl>
      </div>
    `;

    expect(parseAo3Works(document)).toEqual([
      {
        id: "12345",
        element: expect.any(HTMLElement),
        tags: [
          {
            id: "12345:relationship:0",
            text: "Alpha/Beta",
            normalizedText: "alpha/beta",
            category: "relationship",
            element: expect.any(HTMLElement),
            workId: "12345"
          },
          {
            id: "12345:character:0",
            text: "Alice",
            normalizedText: "alice",
            category: "character",
            element: expect.any(HTMLElement),
            workId: "12345"
          },
          {
            id: "12345:freeform:0",
            text: "Canon Divergence",
            normalizedText: "canon divergence",
            category: "freeform",
            element: expect.any(HTMLElement),
            workId: "12345"
          }
        ]
      }
    ]);
  });

  it("returns empty array for work detail pages without a works id in the URL", () => {
    window.history.pushState(null, "", "/users/example");
    document.body.innerHTML = `
      <div id="workskin">
        <dl class="work meta group">
          <dd class="freeform tags">
            <ul class="commas">
              <li><a class="tag" href="/tags/Fluff/works">Fluff</a></li>
            </ul>
          </dd>
        </dl>
      </div>
    `;

    expect(parseAo3Works(document)).toEqual([]);
  });

  it("returns empty array for unrecognized page structure", () => {
    document.body.innerHTML = `<div><p>Not an AO3 page</p></div>`;
    expect(parseAo3Works(document)).toEqual([]);
  });

  it("handles a work with no recognized tag categories", () => {
    document.body.innerHTML = `
      <ol class="work index group">
        <li id="work_456" class="work blurb group">
          <ul class="tags commas">
            <li class="warnings">
              <a class="tag" href="/tags/No%20Warnings/works">No Archive Warnings Apply</a>
            </li>
          </ul>
        </li>
      </ol>
    `;

    const result = parseAo3Works(document);
    expect(result).toEqual([{ id: "work_456", element: expect.any(HTMLElement), tags: [] }]);
  });

  it("parses listing tags even when they are not wrapped in ul.tags", () => {
    document.body.innerHTML = `
      <ol class="work index group">
        <li id="work_987" class="work blurb group">
          <blockquote>
            <p>Search result summary</p>
          </blockquote>
          <ul class="commas">
            <li class="freeforms">
              <a class="tag" href="/tags/Fluff/works">Fluff</a>
            </li>
          </ul>
        </li>
      </ol>
    `;

    const result = parseAo3Works(document);
    expect(result).toHaveLength(1);
    expect(result[0].tags).toEqual([
      expect.objectContaining({
        id: "work_987:freeform:0",
        text: "Fluff",
        normalizedText: "fluff",
        category: "freeform",
      }),
    ]);
  });

  it("parses and renders matches from the saved AO3 search results fixture", () => {
    const fixture = new DOMParser().parseFromString(
      searchResultsFixture,
      "text/html"
    );

    const works = parseAo3Works(fixture);
    const rule: Rule = {
      id: "rule-fluff",
      pattern: "Fluff",
      action: "highlight",
      matchMode: "contains",
      category: "all",
      enabled: true,
      createdAt: 1,
      updatedAt: 1,
    };
    const result = matchRules(works, [rule]);

    renderMatches(works, result);

    expect(works.length).toBeGreaterThan(0);
    expect(works.flatMap((work) => work.tags).some((tag) => tag.text.includes("Fluff"))).toBe(
      true
    );
    expect(result.tagMatches.length).toBeGreaterThan(0);
    expect(fixture.querySelectorAll('[data-ao3th-action="highlight"]').length).toBeGreaterThan(0);
  });

  it("parses multiple works from a listing page", () => {
    document.body.innerHTML = `
      <ol class="work index group">
        <li id="work_1" class="work blurb group">
          <ul class="tags commas">
            <li class="freeforms">
              <a class="tag" href="/tags/Fluff/works">Fluff</a>
            </li>
          </ul>
        </li>
        <li id="work_2" class="work blurb group">
          <ul class="tags commas">
            <li class="relationships">
              <a class="tag" href="/tags/A*s*B/works">A/B</a>
            </li>
          </ul>
        </li>
      </ol>
    `;

    const result = parseAo3Works(document);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("work_1");
    expect(result[0].tags).toHaveLength(1);
    expect(result[0].tags[0].category).toBe("freeform");
    expect(result[1].id).toBe("work_2");
    expect(result[1].tags).toHaveLength(1);
    expect(result[1].tags[0].category).toBe("relationship");
  });

  it("skips work blurbs that have no id", () => {
    document.body.innerHTML = `
      <ol class="work index group">
        <li class="work blurb group">
          <ul class="tags commas">
            <li class="freeforms">
              <a class="tag" href="/tags/Angst/works">Angst</a>
            </li>
          </ul>
        </li>
      </ol>
    `;

    expect(parseAo3Works(document)).toEqual([]);
  });

  it("handles multiple tags in the same category with sequential ids", () => {
    document.body.innerHTML = `
      <ol class="work index group">
        <li id="work_789" class="work blurb group">
          <ul class="tags commas">
            <li class="characters">
              <a class="tag" href="/tags/Alice/works">Alice</a>
            </li>
            <li class="characters">
              <a class="tag" href="/tags/Bob/works">Bob</a>
            </li>
          </ul>
        </li>
      </ol>
    `;

    const result = parseAo3Works(document);
    expect(result[0].tags).toEqual([
      expect.objectContaining({ id: "work_789:character:0", text: "Alice" }),
      expect.objectContaining({ id: "work_789:character:1", text: "Bob" })
    ]);
  });
});
