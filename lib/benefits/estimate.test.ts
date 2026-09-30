import { describe, expect, it } from "vitest";
import { translator } from "../i18n";
import type { Situation } from "../types";
import { calFreshGrossLimit, estimateBenefits } from "./estimate";
import { calFreshFigures } from "./figures";

const t = translator("en");
const FY26 = new Date("2026-09-01T12:00:00Z");
const FY27 = new Date("2026-10-15T12:00:00Z");
const est = (s: Situation, on = FY27) => estimateBenefits(s, t, "en", on);
const byId = (s: Situation, id: string, on = FY27) => est(s, on).estimates.find((e) => e.id === id);

describe("CalFresh figures", () => {
  it("switches to the new federal year on October 1", () => {
    expect(calFreshFigures(FY26).maxAllotment[3]).toBe(994);
    expect(calFreshFigures(FY27).maxAllotment[3]).toBe(1023);
    expect(calFreshFigures(new Date("2026-10-01T12:00:00Z")).label).toBe("Oct 2026 – Sep 2027");
  });

  it("uses 200% of the poverty guideline as California's gross limit", () => {
    expect(calFreshGrossLimit(calFreshFigures(FY27), 1)).toBe(2660);
    expect(calFreshGrossLimit(calFreshFigures(FY27), 4)).toBe(5500);
  });
});

describe("CalFresh estimate", () => {
  const family: Situation = { householdSize: 3, monthlyIncome: 2400, incomeSource: "earned", monthlyHousingCost: 2100 };

  it("computes the standard benefit formula when rent and income are known", () => {
    // FY27: 2400 − 20% (480) − 217 = 1703; shelter 2100 − 851.5 capped at 769; net 934; 808 − 280 = 528.
    expect(byId(family, "calfresh")).toMatchObject({ status: "likely", monthly: { low: 528, high: 528 } });
    // FY26: 2400 − 480 − 209 = 1711; shelter capped at 744; net 967; 785 − 290 = 495.
    expect(byId(family, "calfresh", FY26)?.monthly).toEqual({ low: 495, high: 495 });
  });

  it("gives a range when rent is unknown, and asks for it", () => {
    const noRent: Situation = { householdSize: 3, monthlyIncome: 2400, incomeSource: "earned" };
    const summary = est(noRent);
    const calfresh = summary.estimates.find((e) => e.id === "calfresh")!;
    expect(calfresh.monthly!.low).toBeLessThan(calfresh.monthly!.high);
    expect(summary.missing).toContain("rent");
  });

  it("does not cap shelter costs for older adults and applies the minimum benefit", () => {
    const senior: Situation = { householdSize: 1, monthlyIncome: 1200, incomeSource: "unearned", age: 72, monthlyHousingCost: 1100 };
    // 1200 − 217 = 983; shelter 1100 − 491.5 = 608.5 (uncapped); net 374.5; 306 − 112 = 194.
    expect(byId(senior, "calfresh")?.monthly).toEqual({ low: 194, high: 194 });
    const noRent = { ...senior, monthlyHousingCost: undefined };
    // Without rent the low end falls to the $25 minimum for a 1-person household.
    expect(byId(noRent, "calfresh")?.monthly).toEqual({ low: 25, high: 306 });
  });

  it("leaves out CalFresh when income is over the limit", () => {
    expect(byId({ householdSize: 1, monthlyIncome: 3000, incomeSource: "earned" }, "calfresh")).toBeUndefined();
  });

  it("only says 'possible' and shows the ceiling when income is unknown", () => {
    const e = byId({ householdSize: 4, needs: ["food"] }, "calfresh");
    expect(e).toMatchObject({ status: "possible" });
    expect(e?.monthly).toBeUndefined();
    expect(e?.valueText).toContain("$1,023");
  });
});

describe("other benefits", () => {
  it("links CARE to CalFresh and shows school meals for families", () => {
    const s: Situation = { householdSize: 3, monthlyIncome: 2400, incomeSource: "earned", hasChildren: true };
    const ids = est(s).estimates.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(["calfresh", "medi_cal", "care", "school_meals", "caleitc"]));
    expect(byId(s, "care")?.why[0]).toMatch(/CalFresh/);
  });

  it("offers FERA to a larger household just above the CARE limit", () => {
    const s: Situation = { householdSize: 4, monthlyIncome: 5833, incomeSource: "earned" };
    const ids = est(s).estimates.map((e) => e.id);
    expect(ids).toContain("fera");
    expect(ids).not.toContain("care");
    expect(ids).not.toContain("calfresh");
  });

  it("uses the higher Medi-Cal limit during pregnancy", () => {
    // 2 people + unborn child = 3; 213% of $26,650 = $56,765. $4,000/mo = $48,000/yr.
    const s: Situation = { householdSize: 2, monthlyIncome: 4000, incomeSource: "earned", isPregnant: true };
    expect(byId(s, "medi_cal")?.status).toBe("likely");
    expect(byId({ ...s, isPregnant: undefined }, "medi_cal")).toBeUndefined();
    expect(byId(s, "wic")?.status).toBe("likely");
  });

  it("totals only 'likely' dollar amounts", () => {
    const s: Situation = { householdSize: 3, monthlyIncome: 2400, incomeSource: "earned", monthlyHousingCost: 2100 };
    expect(est(s).monthlyTotal).toEqual({ low: 528, high: 528 });
    expect(est({ needs: ["food"] }).monthlyTotal).toBeUndefined();
  });

  it("translates the text", () => {
    const es = estimateBenefits({ householdSize: 3, monthlyIncome: 2400, incomeSource: "earned" }, translator("es"), "es", FY27);
    expect(es.estimates[0].title).not.toBe(t("benefit.calfresh.title"));
  });
});
