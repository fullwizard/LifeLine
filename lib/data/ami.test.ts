import { describe, expect, it } from "vitest";
import { lookupAreaMedianIncome } from "./ami";
import { amiLimitAnnual } from "../matching/income";

describe("AMI lookup", () => {
  it("resolves Bay Area counties with or without the word County", () => {
    expect(lookupAreaMedianIncome({ county: "Santa Clara County" })).toBe(205_500);
    expect(lookupAreaMedianIncome({ county: "santa clara" })).toBe(205_500);
    expect(lookupAreaMedianIncome({ county: "San Mateo County" })).toBe(210_100);
    expect(lookupAreaMedianIncome({ county: "Alameda County" })).toBe(162_800);
  });

  it("returns undefined for unknown or missing counties", () => {
    expect(lookupAreaMedianIncome({ city: "Seattle" })).toBeUndefined();
    expect(lookupAreaMedianIncome({ county: "King County" })).toBeUndefined();
    expect(lookupAreaMedianIncome(undefined)).toBeUndefined();
  });

  it("reproduces HUD's published 4-person limits for high-cost areas", () => {
    expect(Math.round(amiLimitAnnual(210_100, 4, 50))).toBe(105_050);
    expect(Math.round(amiLimitAnnual(217_500, 4, 80))).toBe(174_000);
  });

  it("produces sensible household-adjusted limits", () => {
    // 80% AMI for one person in Santa Clara ≈ $115k with HUD's 0.7 factor.
    const limit = amiLimitAnnual(205_500, 1, 80);
    expect(limit).toBeGreaterThan(110_000);
    expect(limit).toBeLessThan(120_000);
  });
});
