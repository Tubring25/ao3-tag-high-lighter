import { startPageObserver, stopPageObserver } from "./pageObserver";

describe("pageObserver", () => {
  afterEach(() => {
    stopPageObserver();
    document.body.innerHTML = "";
  });

  it("calls the callback when nodes are added under #main", async () => {
    document.body.innerHTML = `<main id="main"></main>`;
    const callback = vi.fn();

    startPageObserver(callback);
    document.querySelector("#main")?.appendChild(document.createElement("article"));
    await flushMutationObserver();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("falls back to document.body when #main is missing", async () => {
    const callback = vi.fn();

    startPageObserver(callback);
    document.body.appendChild(document.createElement("article"));
    await flushMutationObserver();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("ignores attributes but observes text changes", async () => {
    document.body.innerHTML = `<main id="main"><p id="target">Old</p></main>`;
    const callback = vi.fn();

    startPageObserver(callback);
    document.querySelector("#target")?.setAttribute("data-test", "changed");
    await flushMutationObserver();
    expect(callback).not.toHaveBeenCalled();
    const text = document.querySelector("#target")?.firstChild;
    if (text) text.textContent = "New";
    await flushMutationObserver();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("observes replacement and removal of host text nodes", async () => {
    document.body.innerHTML = `<main id="main"><a class="tag">Old</a></main>`;
    const callback = vi.fn();
    startPageObserver(callback);
    const tag = document.querySelector("a")!;
    tag.textContent = "New";
    await flushMutationObserver();
    tag.firstChild!.remove();
    await flushMutationObserver();
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("ignores plugin text and nested children, including removals", async () => {
    document.body.innerHTML = `<main id="main"><button data-ao3th-collapse-placeholder><span>Old</span></button></main>`;
    const callback = vi.fn();
    startPageObserver(callback);
    const span = document.querySelector("span")!;
    span.firstChild!.textContent = "Changed";
    await flushMutationObserver();
    span.textContent = "Replaced";
    span.append(document.createElement("strong"));
    span.remove();
    await flushMutationObserver();
    expect(callback).not.toHaveBeenCalled();
  });

  it("observes added and removed host containers containing plugin descendants", async () => {
    document.body.innerHTML = `<main id="main"></main>`;
    const callback = vi.fn();
    startPageObserver(callback);
    const host = document.createElement("article");
    host.innerHTML = `<div data-ao3th-warn-banner>Warning</div><a class="tag">New tag</a>`;
    document.querySelector("main")!.append(host);
    await flushMutationObserver();
    host.remove();
    await flushMutationObserver();
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("ignores plugin-owned DOM changes", async () => {
    document.body.innerHTML = `<main id="main"></main>`;
    const callback = vi.fn();

    startPageObserver(callback);
    const pluginNode = document.createElement("div");
    pluginNode.id = "ao3th-hover-host";
    document.querySelector("#main")?.appendChild(pluginNode);
    await flushMutationObserver();

    expect(callback).not.toHaveBeenCalled();
  });

  it("ignores injected warn banners", async () => {
    document.body.innerHTML = `<main id="main"></main>`;
    const callback = vi.fn();

    startPageObserver(callback);
    const banner = document.createElement("div");
    banner.dataset.ao3thWarnBanner = "true";
    document.querySelector("#main")?.appendChild(banner);
    await flushMutationObserver();

    expect(callback).not.toHaveBeenCalled();
  });

  it("ignores injected collapse rule bars", async () => {
    document.body.innerHTML = `<main id="main"></main>`;
    const callback = vi.fn();

    startPageObserver(callback);
    const banner = document.createElement("div");
    banner.dataset.ao3thCollapseMatchBanner = "true";
    document.querySelector("#main")?.appendChild(banner);
    await flushMutationObserver();

    expect(callback).not.toHaveBeenCalled();
  });

  it("stops observing after stopPageObserver", async () => {
    document.body.innerHTML = `<main id="main"></main>`;
    const callback = vi.fn();

    startPageObserver(callback);
    stopPageObserver();
    document.querySelector("#main")?.appendChild(document.createElement("article"));
    await flushMutationObserver();

    expect(callback).not.toHaveBeenCalled();
  });

  it("does not register duplicate observers when started repeatedly", async () => {
    document.body.innerHTML = `<main id="main"></main>`;
    const callback = vi.fn();

    startPageObserver(callback);
    startPageObserver(callback);
    document.querySelector("#main")?.appendChild(document.createElement("article"));
    await flushMutationObserver();

    expect(callback).toHaveBeenCalledTimes(1);
  });
});

async function flushMutationObserver(): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    await Promise.resolve();
  }
}
