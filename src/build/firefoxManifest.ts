export const FIREFOX_GECKO_ID = "ao3-tag-highlighter@tubring25";
export const FIREFOX_DESKTOP_MIN_VERSION = "140.0";
export const FIREFOX_ANDROID_MIN_VERSION = "142.0";

type Manifest = Record<string, unknown>;

export function toFirefoxManifest(base: Manifest): Manifest {
  const { background: _background, options_page: optionsPage, ...rest } = base;
  return {
    ...rest,
    background: { scripts: ["background/index.js"] },
    options_ui: {
      page: typeof optionsPage === "string" ? optionsPage : "options.html",
      open_in_tab: true,
    },
    browser_specific_settings: {
      gecko: {
        id: FIREFOX_GECKO_ID,
        strict_min_version: FIREFOX_DESKTOP_MIN_VERSION,
        data_collection_permissions: { required: ["none"] },
      },
      gecko_android: { strict_min_version: FIREFOX_ANDROID_MIN_VERSION },
    },
  };
}
