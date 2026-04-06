import { parseAo3Works } from "./ao3Parser";

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
        id: "workskin",
        element: expect.any(HTMLElement),
        tags: [
          {
            id: "workskin:relationship:0",
            text: "Alpha/Beta",
            normalizedText: "alpha/beta",
            category: "relationship",
            element: expect.any(HTMLElement),
            workId: "workskin"
          },
          {
            id: "workskin:character:0",
            text: "Alice",
            normalizedText: "alice",
            category: "character",
            element: expect.any(HTMLElement),
            workId: "workskin"
          },
          {
            id: "workskin:freeform:0",
            text: "Canon Divergence",
            normalizedText: "canon divergence",
            category: "freeform",
            element: expect.any(HTMLElement),
            workId: "workskin"
          }
        ]
      }
    ]);
  });
});
