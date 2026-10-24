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

  it("flags slang and euphemisms", () => {
    for (const text of [
      `I actually want to kms- all my friends and family left me. I'm living in a car.`,
      "i want to kms",
      "KMS honestly",
      "thinking of unaliving myself",
      "I'm going to unalive myself tonight",
      "I want to kill my self",
      "I want to off myself",
      "I just want to end it",
      "I'm gonna end it tonight",
      "thinking about ending it",
      "no one would miss me",
      "nobody'd miss me if I was gone",
      "everyone is better off without me",
      "I wish I was never born",
      "I wish I wouldn't wake up",
      "I don't want to exist anymore",
      "I just want to disappear",
      "I'm going to take all my pills",
    ]) {
      expect(detectCrisisIndicators(text), text).toEqual(["suicide_or_self_harm"]);
    }
  });

  it("does not flag innocent uses of the same words", () => {
    for (const text of [
      "I drive 10 kms to the food bank each way",
      "it is 12 kms from the shelter",
      "I want to end it with my boyfriend, he is why I lost the apartment",
      "I don't want to shoot myself in the foot by missing the deadline",
      "I drown myself in work and still can't pay rent",
      "I wish I would wake up earlier for my shift",
      "I forgot to take my pills and my phone",
      "my car is dead and I can't get to work",
    ]) {
      expect(detectCrisisIndicators(text), text).toEqual([]);
    }
  });

  it("respects an explicit denial of slang too", () => {
    expect(detectCrisisIndicators("I'm not going to kms, I just need help with rent")).toEqual([]);
    expect(detectCrisisIndicators("I would never unalive myself")).toEqual([]);
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
