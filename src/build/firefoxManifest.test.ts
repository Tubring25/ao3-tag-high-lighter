import {
  FIREFOX_ANDROID_MIN_VERSION,
  FIREFOX_DESKTOP_MIN_VERSION,
  FIREFOX_GECKO_ID,
  toFirefoxManifest,
} from "./firefoxManifest";

describe("toFirefoxManifest", () => {
  it("converts the Chrome background and options declarations for Firefox", () => {
    const input = createManifest();
    const output = toFirefoxManifest(input);

    expect(output.background).toEqual({ scripts: ["background/index.js"] });
    expect(output.background).not.toHaveProperty("service_worker");
    expect(output.background).not.toHaveProperty("type");
    expect(output).not.toHaveProperty("options_page");
    expect(output.options_ui).toEqual({ page: "options.html", open_in_tab: true });
  });

  it("adds the Firefox desktop, Android and data collection declarations", () => {
    const output = toFirefoxManifest(createManifest());

    expect(output.browser_specific_settings).toEqual({
      gecko: {
        id: FIREFOX_GECKO_ID,
        strict_min_version: FIREFOX_DESKTOP_MIN_VERSION,
        data_collection_permissions: { required: ["none"] },
      },
      gecko_android: { strict_min_version: FIREFOX_ANDROID_MIN_VERSION },
    });
  });

  it("preserves declarations shared by Chrome and Firefox", () => {
    const input = createManifest();
    const output = toFirefoxManifest(input);

    for (const key of [
      "permissions",
      "host_permissions",
      "content_scripts",
      "action",
      "icons",
      "default_locale",
      "version",
    ]) {
      expect(output[key]).toEqual(input[key]);
    }
  });

  it("uses options.html when options_page is absent or invalid", () => {
    expect(toFirefoxManifest({}).options_ui).toEqual({ page: "options.html", open_in_tab: true });
    expect(toFirefoxManifest({ options_page: 42 }).options_ui).toEqual({
      page: "options.html",
      open_in_tab: true,
    });
  });

  it("does not mutate the source manifest", () => {
    const input = createManifest();
    const before = structuredClone(input);

    toFirefoxManifest(input);

    expect(input).toEqual(before);
  });
});

function createManifest(): Record<string, unknown> {
  return {
    manifest_version: 3,
    version: "0.1.2",
    default_locale: "en",
    permissions: ["storage"],
    host_permissions: ["https://*.archiveofourown.org/*"],
    background: { service_worker: "background/index.js", type: "module" },
    content_scripts: [{ matches: ["https://*.archiveofourown.org/*"] }],
    action: { default_popup: "popup.html" },
    icons: { 16: "icons/icon-16.png" },
    options_page: "options.html",
  };
}
