import { describe, expect, it } from "vitest";
import { hasImmediateSafetyConcern } from "./safety";

describe("immediate safety detection", () => {
  it("detects direct suicide and self-harm concerns", () => {
    expect(hasImmediateSafetyConcern({ rawText: "I am thinking about suicide." })).toBe(true);
    expect(hasImmediateSafetyConcern({ rawText: "feeling of self harm" })).toBe(true);
  });

  it("does not trigger for explicit denials", () => {
    expect(hasImmediateSafetyConcern({ rawText: "I am not suicidal and have no thoughts of self-harm." })).toBe(false);
  });
});
