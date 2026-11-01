import {
  CUSTOM_HOST_SCRIPT_ID,
  syncCustomHostScripts,
  toExtensionRelativePath,
  type CustomHostContentScript,
  type CustomHostScriptsApi,
} from "./customHostScripts";

const FILES = { js: ["content/index.js"], css: ["assets/content.css"] };

describe("syncCustomHostScripts", () => {
  it("registers one script for all granted custom hosts", async () => {
    const api = createApi({
      origins: ["https://*.archiveofourown.org/*", "https://b.example/*", "https://a.example/*"],
    });

    await syncCustomHostScripts(api);

    expect(api.unregisterScripts).not.toHaveBeenCalled();
    expect(api.registerScripts).toHaveBeenCalledWith([
      { id: CUSTOM_HOST_SCRIPT_ID, matches: ["https://a.example/*", "https://b.example/*"], ...FILES },
    ]);
  });

  it("does nothing when no custom host is granted and nothing is registered", async () => {
    const api = createApi({ origins: ["https://*.archiveofourown.org/*", "https://*/*"] });

    await syncCustomHostScripts(api);

    expect(api.registerScripts).not.toHaveBeenCalled();
    expect(api.unregisterScripts).not.toHaveBeenCalled();
  });

  it("keeps an up-to-date registration untouched", async () => {
    const api = createApi({
      origins: ["https://a.example/*", "https://b.example/*"],
      registered: [{ id: CUSTOM_HOST_SCRIPT_ID, matches: ["https://b.example/*", "https://a.example/*"], ...FILES }],
    });

    await syncCustomHostScripts(api);

    expect(api.registerScripts).not.toHaveBeenCalled();
    expect(api.unregisterScripts).not.toHaveBeenCalled();
  });

  it("re-registers when the granted hosts change", async () => {
    const api = createApi({
      origins: ["https://a.example/*", "https://c.example/*"],
      registered: [{ id: CUSTOM_HOST_SCRIPT_ID, matches: ["https://a.example/*", "https://b.example/*"], ...FILES }],
    });

    await syncCustomHostScripts(api);

    expect(api.unregisterScripts).toHaveBeenCalledWith([CUSTOM_HOST_SCRIPT_ID]);
    expect(api.registerScripts).toHaveBeenCalledWith([
      { id: CUSTOM_HOST_SCRIPT_ID, matches: ["https://a.example/*", "https://c.example/*"], ...FILES },
    ]);
    expect(api.unregisterScripts.mock.invocationCallOrder[0]).toBeLessThan(
      api.registerScripts.mock.invocationCallOrder[0]
    );
  });

  it("re-registers when the content script files change", async () => {
    const api = createApi({
      origins: ["https://a.example/*"],
      registered: [{ id: CUSTOM_HOST_SCRIPT_ID, matches: ["https://a.example/*"], js: ["old.js"], css: FILES.css }],
    });

    await syncCustomHostScripts(api);

    expect(api.unregisterScripts).toHaveBeenCalledTimes(1);
    expect(api.registerScripts).toHaveBeenCalledTimes(1);
  });

  it("unregisters when the last custom host is removed", async () => {
    const api = createApi({
      origins: ["https://*.archiveofourown.org/*"],
      registered: [{ id: CUSTOM_HOST_SCRIPT_ID, matches: ["https://a.example/*"], ...FILES }],
    });

    await syncCustomHostScripts(api);

    expect(api.unregisterScripts).toHaveBeenCalledWith([CUSTOM_HOST_SCRIPT_ID]);
    expect(api.registerScripts).not.toHaveBeenCalled();
  });
});

describe("toExtensionRelativePath", () => {
  const base = "moz-extension://5b0c1e9a/";

  it.each([
    ["moz-extension://5b0c1e9a/content/index.js", "content/index.js"],
    ["content/index.js", "content/index.js"],
    ["/assets/content.css", "assets/content.css"],
  ])("maps %s to %s", (file, expected) => {
    expect(toExtensionRelativePath(file, base)).toBe(expected);
  });

  it("keeps Chrome's relative manifest paths when the base URL differs", () => {
    expect(toExtensionRelativePath("content/index.js", "chrome-extension://abc/")).toBe("content/index.js");
  });
});

function createApi({
  origins,
  registered = [],
}: {
  origins: string[];
  registered?: CustomHostContentScript[];
}) {
  return {
    getGrantedOrigins: vi.fn(async () => origins),
    getContentScriptFiles: vi.fn(() => FILES),
    getRegisteredScripts: vi.fn(async (ids: string[]) => registered.filter((script) => ids.includes(script.id))),
    registerScripts: vi.fn(async () => undefined),
    unregisterScripts: vi.fn(async () => undefined),
  } satisfies CustomHostScriptsApi;
}
