import {
  applyDocumentLanguage,
  getEffectiveLanguageTag,
  getLocalizedActionLabel,
  setLanguagePreference,
  t,
} from "./i18n";
import { DEFAULT_ACTION_STYLES } from "../core/actionStyles";

describe("i18n", () => {
  const originalChrome = (globalThis as typeof globalThis & { chrome?: unknown }).chrome;
  const originalLanguage = navigator.language;

  afterEach(() => {
    setLanguagePreference("auto");
    document.documentElement.lang = "";
    (globalThis as typeof globalThis & { chrome?: unknown }).chrome = originalChrome;
    Object.defineProperty(window.navigator, "language", {
      value: originalLanguage,
      configurable: true,
    });
  });

  it("falls back to English messages", () => {
    delete (globalThis as typeof globalThis & { chrome?: unknown }).chrome;

    expect(t("popupManageRules")).toBe("Manage rules");
    expect(t("popupMatchesTitle", [3])).toBe("3 matches on this page");
  });

  it("falls back to Chinese messages when browser language is Chinese", () => {
    delete (globalThis as typeof globalThis & { chrome?: unknown }).chrome;
    Object.defineProperty(window.navigator, "language", {
      value: "zh-CN",
      configurable: true,
    });

    expect(t("popupManageRules")).toBe("管理规则");
    expect(t("popupMatchesTitle", [3])).toBe("当前页命中 3 项");
  });

  it("uses chrome i18n messages when available", () => {
    (globalThis as typeof globalThis & { chrome?: unknown }).chrome = {
      i18n: {
        getMessage: (key: string) => (key === "popupManageRules" ? "Rules from Chrome" : ""),
      },
    };

    expect(t("popupManageRules")).toBe("Rules from Chrome");
  });

  it("uses the manual language preference before chrome i18n", () => {
    (globalThis as typeof globalThis & { chrome?: unknown }).chrome = {
      i18n: {
        getMessage: () => "Rules from Chrome",
      },
    };

    setLanguagePreference("zh_CN");

    expect(t("popupManageRules")).toBe("管理规则");
  });

  it("exposes the effective language tag for CSS language selectors", () => {
    setLanguagePreference("zh_CN");
    applyDocumentLanguage();

    expect(getEffectiveLanguageTag()).toBe("zh-CN");
    expect(document.documentElement.lang).toBe("zh-CN");
  });

  it("localizes default action labels but keeps custom labels", () => {
    delete (globalThis as typeof globalThis & { chrome?: unknown }).chrome;
    Object.defineProperty(window.navigator, "language", {
      value: "zh-CN",
      configurable: true,
    });

    expect(getLocalizedActionLabel("highlight", DEFAULT_ACTION_STYLES)).toBe("高亮");
    expect(
      getLocalizedActionLabel("highlight", {
        ...DEFAULT_ACTION_STYLES,
        highlight: { ...DEFAULT_ACTION_STYLES.highlight, label: "Favorite" },
      })
    ).toBe("Favorite");
  });
});
