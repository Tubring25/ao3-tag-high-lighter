import { normalizeTagText } from "./normalize";

describe("normalizeTagText", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normalizeTagText("  Slow Burn  ")).toBe("slow burn");
  });

  it("collapses repeated internal whitespace", () => {
    expect(normalizeTagText("Enemies   to    Lovers")).toBe("enemies to lovers");
  });

  it("normalizes letter casing", () => {
    expect(normalizeTagText("ALPHA/BETA")).toBe("alpha/beta");
  });
});
