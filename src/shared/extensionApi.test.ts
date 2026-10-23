import { afterEach, describe, expect, it } from "vitest";
import { findExtensionApi, getExtensionApi } from "./extensionApi";

type TestScope = typeof globalThis & { browser?: unknown; chrome?: unknown };

const scope = globalThis as TestScope;
const originalBrowser = Object.getOwnPropertyDescriptor(globalThis, "browser");
const originalChrome = Object.getOwnPropertyDescriptor(globalThis, "chrome");

function restoreGlobal(name: "browser" | "chrome", descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else delete scope[name];
}

describe("extension API lookup", () => {
  afterEach(() => {
    restoreGlobal("browser", originalBrowser);
    restoreGlobal("chrome", originalChrome);
  });

  it("returns chrome when only chrome exists", () => {
    const chromeApi = { name: "chrome" };
    delete scope.browser;
    scope.chrome = chromeApi;

    expect(findExtensionApi()).toBe(chromeApi);
    expect(getExtensionApi()).toBe(chromeApi);
  });

  it("prefers browser when browser and chrome both exist", () => {
    const browserApi = { runtime: {} };
    scope.browser = browserApi;
    scope.chrome = { name: "chrome" };

    expect(findExtensionApi()).toBe(browserApi);
    expect(getExtensionApi()).toBe(browserApi);
  });

  it("ignores a page element clobbering window.browser", () => {
    const chromeApi = { runtime: {} };
    const element = document.createElement("div");
    element.id = "browser";
    document.body.append(element);
    scope.browser = element;
    scope.chrome = chromeApi;

    expect(findExtensionApi()).toBe(chromeApi);
    element.remove();
  });

  it("reports a missing API when neither global exists", () => {
    delete scope.browser;
    delete scope.chrome;

    expect(findExtensionApi()).toBeUndefined();
    expect(() => getExtensionApi()).toThrow("Extension API is unavailable");
  });
});
