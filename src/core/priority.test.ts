import { resolveHighestPriorityAction } from "./priority";

describe("resolveHighestPriorityAction", () => {
  it("prefers hideWork over warn and highlight", () => {
    expect(resolveHighestPriorityAction(["highlight", "warn", "hideWork"])).toBe("hideWork");
  });

  it("prefers warn over highlight", () => {
    expect(resolveHighestPriorityAction(["highlight", "warn"])).toBe("warn");
  });

  it("returns highlight when highlight is the only action", () => {
    expect(resolveHighestPriorityAction(["highlight"])).toBe("highlight");
  });
});
