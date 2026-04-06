import { resolveHighestPriorityAction } from "./priority";

describe("resolveHighestPriorityAction", () => {
  it("prefers hideWork over warn, highlight, and mute", () => {
    expect(resolveHighestPriorityAction(["mute", "highlight", "warn", "hideWork"])).toBe(
      "hideWork"
    );
  });

  it("prefers warn over highlight and mute", () => {
    expect(resolveHighestPriorityAction(["mute", "highlight", "warn"])).toBe("warn");
  });

  it("prefers highlight over mute", () => {
    expect(resolveHighestPriorityAction(["mute", "highlight"])).toBe("highlight");
  });
});
