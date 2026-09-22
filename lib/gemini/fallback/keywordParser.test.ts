import { describe, expect, it } from "vitest";
import { parseSituationByKeywords } from "./keywordParser";

describe("keyword parser fallback", () => {
  it("extracts location, status, needs, children, and income", () => {
    const s = parseSituationByKeywords(
      "I live in San Jose with my two kids. Got a pay or vacate notice yesterday, I make about $2,400 a month and I'm behind on rent. Also our power might get shut off.",
    );
    expect(s.location?.county).toBe("Santa Clara County");
    expect(s.housingStatus).toBe("eviction_notice");
    expect(s.hasChildren).toBe(true);
    expect(s.monthlyIncome).toBe(2400);
    expect(s.needs).toEqual(expect.arrayContaining(["rental_assistance", "utility", "legal"]));
  });

  it("leaves unknown fields undefined rather than guessing", () => {
    const s = parseSituationByKeywords("I need help with food.");
    expect(s.location).toBeUndefined();
    expect(s.housingStatus).toBeUndefined();
    expect(s.hasChildren).toBeUndefined();
    expect(s.isVeteran).toBeUndefined();
    expect(s.monthlyIncome).toBeUndefined();
    expect(s.needs).toEqual(["food"]);
  });

  it("recognises veterans, ZIP codes, and yearly income", () => {
    const s = parseSituationByKeywords("Veteran in 95112, sleeping in my car, made 30k a year before I got laid off");
    expect(s.isVeteran).toBe(true);
    expect(s.location?.zip).toBe("95112");
    expect(s.housingStatus).toBe("unhoused");
    expect(s.monthlyIncome).toBe(2500);
    expect(s.needs).toEqual(expect.arrayContaining(["shelter", "employment"]));
  });

  it("extracts explicitly stated health conditions without treating a denial as a condition", () => {
    const s = parseSituationByKeywords("I have diabetes and PTSD, use a wheelchair, and do not have asthma.");
    expect(s.conditions).toEqual(["mobility_impairment", "mental_health_condition", "diabetes"]);
  });
});
