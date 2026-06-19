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

  it("ignores attribute and text changes", async () => {
    document.body.innerHTML = `<main id="main"><p id="target">Old</p></main>`;
    const callback = vi.fn();

    startPageObserver(callback);
    document.querySelector("#target")?.setAttribute("data-test", "changed");
    const text = document.querySelector("#target")?.firstChild;
    if (text) text.textContent = "New";
    await flushMutationObserver();

    expect(callback).not.toHaveBeenCalled();
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
