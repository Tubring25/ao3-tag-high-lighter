import {
  getCustomHosts,
  getCustomOriginPatterns,
  isAo3Host,
  parseCustomHostInput,
  toCustomOriginPattern,
} from "./customHosts";

describe("parseCustomHostInput", () => {
  it.each([
    ["archiveofourown.gay", "archiveofourown.gay"],
    ["  Archiveofourown.GAY  ", "archiveofourown.gay"],
    ["https://archiveofourown.gay/works/123?view_adult=true", "archiveofourown.gay"],
    ["http://www.example.com:8443/", "www.example.com"],
    ["example.com.", "example.com"],
    ["例え.jp", "xn--r8jz45g.jp"],
  ])("accepts %s", (input, host) => {
    expect(parseCustomHostInput(input)).toEqual({ ok: true, host });
  });

  it("rejects empty input", () => {
    expect(parseCustomHostInput("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it.each([
    "*.example.com",
    "localhost",
    "ftp://example.com",
    "not a host",
    "https://",
    "[::1]",
    "-bad.example.com",
  ])("rejects %s as invalid", (input) => {
    expect(parseCustomHostInput(input)).toEqual({ ok: false, reason: "invalid" });
  });

  it.each(["archiveofourown.org", "https://www.archiveofourown.org/works/1"])(
    "rejects official AO3 host %s",
    (input) => {
      expect(parseCustomHostInput(input)).toEqual({ ok: false, reason: "ao3" });
    }
  );
});

describe("custom host origins", () => {
  it("builds an exact-host https origin pattern", () => {
    expect(toCustomOriginPattern("archiveofourown.gay")).toBe("https://archiveofourown.gay/*");
  });

  it("extracts sorted custom hosts and skips AO3, wildcard, and malformed origins", () => {
    expect(
      getCustomHosts([
        "https://*.archiveofourown.org/*",
        "https://www.archiveofourown.org/*",
        "https://zeta.example/*",
        "https://*/*",
        "<all_urls>",
        "http://plain.example/*",
        "https://archiveofourown.gay/*",
        "https://archiveofourown.gay/*",
        "https://*.wild.example/*",
        "https://port.example:8443/*",
      ])
    ).toEqual(["archiveofourown.gay", "zeta.example"]);
  });

  it("returns origin patterns for custom hosts", () => {
    expect(getCustomOriginPatterns(["https://b.example/*", "https://a.example/*"])).toEqual([
      "https://a.example/*",
      "https://b.example/*",
    ]);
  });

  it("recognizes AO3 subdomains", () => {
    expect(isAo3Host("archiveofourown.org")).toBe(true);
    expect(isAo3Host("www.archiveofourown.org")).toBe(true);
    expect(isAo3Host("archiveofourown.org.evil.example")).toBe(false);
    expect(isAo3Host("notarchiveofourown.org")).toBe(false);
  });
});
