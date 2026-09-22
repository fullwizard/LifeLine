import { describe, expect, it } from "vitest";
import { detectCrisisIndicators, withCrisisIndicators } from "./crisis";

describe("crisis detection", () => {
  it("flags suicide and self-harm language", () => {
    for (const text of [
      "I've been thinking about suicide",
      "honestly i just want to die",
      "I don't want to be here anymore",
      "sometimes I think about killing myself",
      "been cutting myself again",
      "everyone would be better off without me, I'm better off dead",
      "no reason to go on",
    ]) {
      expect(detectCrisisIndicators(text), text).toEqual(["suicide_or_self_harm"]);
    }
  });

  it("does not flag ordinary hardship language", () => {
    for (const text of [
      "I'm behind on rent and really stressed",
      "I lost my job and I'm scared",
      "my landlord is killing me with these fees",
      "we're dying to find a place",
      "I want to live in San Jose",
    ]) {
      expect(detectCrisisIndicators(text), text).toEqual([]);
    }
  });

  it("respects an explicit denial but not a loose one", () => {
    expect(detectCrisisIndicators("I am not suicidal and have no thoughts of self-harm.")).toEqual([]);
    expect(detectCrisisIndicators("everyone would be better off without me, I'm better off dead")).toEqual(["suicide_or_self_harm"]);
    expect(detectCrisisIndicators("I don't want to be here anymore")).toEqual(["suicide_or_self_harm"]);
  });

  it("attaches indicators to a situation without touching other fields", () => {
    const s = withCrisisIndicators({ householdSize: 2 }, "I want to die");
    expect(s).toEqual({ householdSize: 2, crisisIndicators: ["suicide_or_self_harm"] });
    expect(withCrisisIndicators({ householdSize: 2 }, "need rent help")).toEqual({ householdSize: 2 });
  });
});
