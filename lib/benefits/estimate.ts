/**
 * Benefit estimator: turns what a person told us into dollar amounts and
 * discounts from the big statewide programs (CalFresh, CARE/FERA, Medi-Cal,
 * WIC, free school meals, CalEITC).
 *
 * Pure: no I/O, no AI. Same rule as the matching engine: unknown ≠ met. When
 * a fact is missing we widen the range or say "possibly", never assume the
 * favorable answer. Every estimate lists the assumptions it made.
 */
import { formatMoney, type Lang, type T } from "../i18n";
import type { Situation } from "../types";
import { CALEITC_MAX_EARNED, calFreshFigures, fplAnnual, LINKS, type CalFreshYear } from "./figures";

export type BenefitId = "calfresh" | "care" | "fera" | "medi_cal" | "medi_cal_kids" | "wic" | "school_meals" | "caleitc";

export interface BenefitEstimate {
  id: BenefitId;
  /** likely = the numbers we have point to yes; possible = depends on something we don't know. */
  status: "likely" | "possible";
  title: string;
  /** Headline value, e.g. "About $412–$535 a month". */
  valueText: string;
  /** Monthly cash-equivalent range, when it can be computed. Used for the total. */
  monthly?: { low: number; high: number };
  why: string[];
  assumptions: string[];
  apply: { url: string; phone?: string };
  /** Other benefits this one makes you automatically eligible for. */
  unlocks?: BenefitId[];
}

export interface BenefitSummary {
  estimates: BenefitEstimate[];
  /** Sum of the monthly ranges of "likely" estimates. */
  monthlyTotal?: { low: number; high: number };
  figuresLabel: string;
  /** What to tell us next for a sharper estimate. */
  missing: ("income" | "householdSize" | "rent")[];
}

// ---------------------------------------------------------------------------
// CalFresh
// ---------------------------------------------------------------------------

function maxAllotment(y: CalFreshYear, size: number): number {
  const n = Math.max(1, Math.round(size));
  return n <= 8 ? y.maxAllotment[n - 1] : y.maxAllotment[7] + (n - 8) * y.maxAllotmentEachAdditional;
}

function standardDeduction(y: CalFreshYear, size: number): number {
  if (size <= 3) return y.standardDeduction.upTo3;
  if (size === 4) return y.standardDeduction.four;
  if (size === 5) return y.standardDeduction.five;
  return y.standardDeduction.sixPlus;
}

/** California's CalFresh gross income test: 200% of the poverty guideline, monthly. */
export function calFreshGrossLimit(y: CalFreshYear, size: number): number {
  return Math.ceil(fplAnnual(size, 200, y.fpl) / 12);
}

interface CalFreshInput {
  size: number;
  gross: number;
  earnedShare: number; // 0..1 of gross that is earned (gets the 20% deduction)
  shelter: number | "none" | "max"; // monthly rent, or bounds when unknown
  elderlyOrDisabled: boolean;
}

/**
 * Standard SNAP benefit arithmetic:
 * net = gross − 20% of earnings − standard deduction − excess shelter,
 * benefit = max allotment − 30% of net.
 */
export function calFreshBenefit(y: CalFreshYear, input: CalFreshInput): number {
  const { size, gross, earnedShare, shelter, elderlyOrDisabled } = input;
  if (gross > calFreshGrossLimit(y, size)) return 0;
  const adjusted = Math.max(0, gross - 0.2 * gross * earnedShare - standardDeduction(y, size));
  let excessShelter = 0;
  if (shelter === "max") {
    excessShelter = elderlyOrDisabled ? adjusted : y.shelterCap;
  } else if (typeof shelter === "number") {
    excessShelter = Math.max(0, shelter - adjusted / 2);
    if (!elderlyOrDisabled) excessShelter = Math.min(excessShelter, y.shelterCap);
  }
  const net = Math.max(0, adjusted - excessShelter);
  const benefit = maxAllotment(y, size) - Math.round(0.3 * net);
  if (benefit <= 0) return 0;
  return size <= 2 ? Math.max(benefit, y.minimumBenefit) : benefit;
}

function elderlyOrDisabled(s: Situation): boolean {
  return (s.age !== undefined && s.age >= 60) || (s.conditions ?? []).some((c) => c === "disability" || c === "mobility_impairment");
}

function estimateCalFresh(s: Situation, t: T, lang: Lang, y: CalFreshYear): BenefitEstimate | null {
  const size = s.householdSize;
  const apply = { url: LINKS.calfresh.url, phone: LINKS.calfresh.phone };
  const title = t("benefit.calfresh.title");
  const unlocks: BenefitId[] = ["care", "wic", "school_meals"];

  if (s.monthlyIncome === undefined || size === undefined) {
    // Show the ceiling so people know what is at stake, but only as "possible".
    const n = size ?? 1;
    return {
      id: "calfresh",
      status: "possible",
      title,
      valueText: t("benefit.calfresh.upTo", { amount: formatMoney(maxAllotment(y, n), lang), size: n }),
      why: [t("benefit.calfresh.why.general")],
      assumptions: [s.monthlyIncome === undefined ? t("benefit.assume.noIncome") : t("benefit.assume.noHousehold")],
      apply,
      unlocks,
    };
  }

  const gross = s.monthlyIncome;
  const limit = calFreshGrossLimit(y, size);
  if (gross > limit) return null;

  const eod = elderlyOrDisabled(s);
  const earnedLow = s.incomeSource === "earned" ? 1 : 0;
  const earnedHigh = s.incomeSource === "unearned" ? 0 : 1;
  const shelterLow = s.monthlyHousingCost ?? "none";
  const shelterHigh = s.monthlyHousingCost ?? "max";
  const low = calFreshBenefit(y, { size, gross, earnedShare: earnedLow, shelter: shelterLow, elderlyOrDisabled: eod });
  const high = calFreshBenefit(y, { size, gross, earnedShare: earnedHigh, shelter: shelterHigh, elderlyOrDisabled: eod });
  if (high <= 0) return null;

  const assumptions: string[] = [];
  if (s.monthlyHousingCost === undefined) assumptions.push(t("benefit.assume.noRent"));
  else assumptions.push(t("benefit.assume.rent", { amount: formatMoney(s.monthlyHousingCost, lang) }));
  if (s.incomeSource === undefined || s.incomeSource === "mixed") assumptions.push(t("benefit.assume.incomeSource"));
  assumptions.push(t("benefit.assume.utilities"));
  assumptions.push(t("benefit.assume.figures", { period: y.label }));

  return {
    id: "calfresh",
    status: low > 0 ? "likely" : "possible",
    title,
    valueText:
      low === high
        ? t("benefit.calfresh.about", { amount: formatMoney(high, lang) })
        : t("benefit.calfresh.range", { low: formatMoney(Math.max(low, 0), lang), high: formatMoney(high, lang) }),
    monthly: { low: Math.max(low, 0), high },
    why: [
      t("benefit.calfresh.why.under", {
        income: formatMoney(gross, lang),
        limit: formatMoney(limit, lang),
        size,
      }),
      t("benefit.calfresh.why.fast"),
    ],
    assumptions,
    apply,
    unlocks,
  };
}

// ---------------------------------------------------------------------------
// Energy discounts (PG&E CARE / FERA)
// ---------------------------------------------------------------------------

function careLimitAnnual(size: number): number {
  return fplAnnual(Math.max(size, 2), 200);
}

function estimateEnergy(s: Situation, t: T, lang: Lang, calFreshLikely: boolean): BenefitEstimate | null {
  const wantsUtility = (s.needs ?? []).includes("utility");
  const care = { url: LINKS.care.url, phone: LINKS.care.phone };
  const base = {
    title: t("benefit.care.title"),
    valueText: t("benefit.care.value"),
    apply: care,
  };
  if (calFreshLikely) {
    return { id: "care", status: "likely", ...base, why: [t("benefit.care.why.calfresh")], assumptions: [t("benefit.assume.pge")] };
  }
  if (s.monthlyIncome === undefined) {
    return wantsUtility
      ? { id: "care", status: "possible", ...base, why: [t("benefit.care.why.general")], assumptions: [t("benefit.assume.noIncome"), t("benefit.assume.pge")] }
      : null;
  }
  const annual = s.monthlyIncome * 12;
  const size = s.householdSize;
  if (size === undefined) {
    if (annual <= careLimitAnnual(1)) {
      return { id: "care", status: "likely", ...base, why: [t("benefit.care.why.anySize")], assumptions: [t("benefit.assume.pge")] };
    }
    if (annual <= careLimitAnnual(8)) {
      return { id: "care", status: "possible", ...base, why: [t("benefit.care.why.general")], assumptions: [t("benefit.assume.noHousehold"), t("benefit.assume.pge")] };
    }
    return null;
  }
  const careLimit = careLimitAnnual(size);
  if (annual <= careLimit) {
    return {
      id: "care",
      status: "likely",
      ...base,
      why: [t("benefit.care.why.under", { income: formatMoney(annual, lang), limit: formatMoney(careLimit, lang), size })],
      assumptions: [t("benefit.assume.pge")],
    };
  }
  const feraLimit = fplAnnual(size, 250);
  if (size >= 3 && annual <= feraLimit) {
    return {
      id: "fera",
      status: "likely",
      title: t("benefit.fera.title"),
      valueText: t("benefit.fera.value"),
      why: [t("benefit.fera.why", { income: formatMoney(annual, lang), limit: formatMoney(feraLimit, lang), size })],
      assumptions: [t("benefit.assume.pge")],
      apply: { url: LINKS.fera.url, phone: LINKS.fera.phone },
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Health coverage
// ---------------------------------------------------------------------------

function estimateMediCal(s: Situation, t: T, lang: Lang): BenefitEstimate[] {
  const out: BenefitEstimate[] = [];
  const apply = { url: LINKS.mediCal.url, phone: LINKS.mediCal.phone };
  if (s.monthlyIncome === undefined || s.householdSize === undefined) {
    if ((s.needs ?? []).includes("health") || s.isPregnant) {
      out.push({
        id: "medi_cal",
        status: "possible",
        title: t("benefit.medical.title"),
        valueText: t("benefit.medical.value"),
        why: [t("benefit.medical.why.general")],
        assumptions: [s.monthlyIncome === undefined ? t("benefit.assume.noIncome") : t("benefit.assume.noHousehold")],
        apply,
      });
    }
    return out;
  }
  const annual = s.monthlyIncome * 12;
  const size = s.householdSize + (s.isPregnant ? 1 : 0); // Medi-Cal counts an unborn child
  const adultPct = s.isPregnant ? 213 : 138;
  const adultLimit = fplAnnual(size, adultPct);
  if (annual <= adultLimit) {
    out.push({
      id: "medi_cal",
      status: "likely",
      title: t("benefit.medical.title"),
      valueText: t("benefit.medical.value"),
      why: [
        t(s.isPregnant ? "benefit.medical.why.pregnant" : "benefit.medical.why.adult", {
          income: formatMoney(annual, lang),
          limit: formatMoney(adultLimit, lang),
          size,
        }),
      ],
      assumptions: [t("benefit.assume.medicalAssets")],
      apply,
    });
  }
  const kidLimit = fplAnnual(size, 266);
  if (s.hasChildren && annual <= kidLimit && annual > adultLimit) {
    out.push({
      id: "medi_cal_kids",
      status: "likely",
      title: t("benefit.medicalKids.title"),
      valueText: t("benefit.medical.value"),
      why: [t("benefit.medicalKids.why", { income: formatMoney(annual, lang), limit: formatMoney(kidLimit, lang), size })],
      assumptions: [],
      apply,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Families
// ---------------------------------------------------------------------------

function estimateWic(s: Situation, t: T, lang: Lang, onProgram: boolean): BenefitEstimate | null {
  if (!s.isPregnant && !s.hasChildren) return null;
  const apply = { url: LINKS.wic.url, phone: LINKS.wic.phone };
  const who = s.isPregnant ? t("benefit.wic.who.pregnant") : t("benefit.wic.who.kids");
  const base = { id: "wic" as const, title: t("benefit.wic.title"), valueText: t("benefit.wic.value"), apply };
  // Kids' ages are unknown, so WIC is "possible" unless the person is pregnant.
  const certainWho = Boolean(s.isPregnant);
  if (onProgram) {
    return { ...base, status: certainWho ? "likely" : "possible", why: [who, t("benefit.wic.why.adjunct")], assumptions: certainWho ? [] : [t("benefit.assume.kidAges")] };
  }
  if (s.monthlyIncome === undefined || s.householdSize === undefined) return null;
  const size = s.householdSize + (s.isPregnant ? 1 : 0);
  const limit = fplAnnual(size, 185);
  const annual = s.monthlyIncome * 12;
  if (annual > limit) return null;
  return {
    ...base,
    status: certainWho ? "likely" : "possible",
    why: [who, t("benefit.wic.why.under", { income: formatMoney(annual, lang), limit: formatMoney(limit, lang), size })],
    assumptions: certainWho ? [] : [t("benefit.assume.kidAges")],
  };
}

function estimateSchoolMeals(s: Situation, t: T): BenefitEstimate | null {
  if (!s.hasChildren) return null;
  return {
    id: "school_meals",
    status: "likely",
    title: t("benefit.meals.title"),
    valueText: t("benefit.meals.value"),
    why: [t("benefit.meals.why")],
    assumptions: [t("benefit.assume.publicSchool")],
    apply: { url: LINKS.schoolMeals },
  };
}

function estimateCalEitc(s: Situation, t: T, lang: Lang): BenefitEstimate | null {
  if (s.monthlyIncome === undefined || s.monthlyIncome <= 0) return null;
  if (s.incomeSource !== "earned" && s.incomeSource !== "mixed") return null;
  const annual = s.monthlyIncome * 12;
  if (annual > CALEITC_MAX_EARNED) return null;
  return {
    id: "caleitc",
    status: "possible",
    title: t("benefit.caleitc.title"),
    valueText: t("benefit.caleitc.value"),
    why: [t("benefit.caleitc.why", { income: formatMoney(annual, lang), limit: formatMoney(CALEITC_MAX_EARNED, lang) })],
    assumptions: [t("benefit.assume.taxes")],
    apply: { url: LINKS.calEitc },
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const ORDER: BenefitId[] = ["calfresh", "medi_cal", "medi_cal_kids", "care", "fera", "wic", "school_meals", "caleitc"];

export function estimateBenefits(situation: Situation, t: T, lang: Lang = "en", on: Date = new Date()): BenefitSummary {
  const y = calFreshFigures(on);
  const estimates: BenefitEstimate[] = [];

  const calFresh = estimateCalFresh(situation, t, lang, y);
  if (calFresh) estimates.push(calFresh);
  const calFreshLikely = calFresh?.status === "likely";

  const medi = estimateMediCal(situation, t, lang);
  estimates.push(...medi);
  const onProgram = calFreshLikely || medi.some((m) => m.status === "likely");

  for (const e of [
    estimateEnergy(situation, t, lang, calFreshLikely),
    estimateWic(situation, t, lang, onProgram),
    estimateSchoolMeals(situation, t),
    estimateCalEitc(situation, t, lang),
  ]) {
    if (e) estimates.push(e);
  }
  estimates.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));

  const likelyMoney = estimates.filter((e) => e.status === "likely" && e.monthly);
  const monthlyTotal = likelyMoney.length
    ? likelyMoney.reduce((acc, e) => ({ low: acc.low + e.monthly!.low, high: acc.high + e.monthly!.high }), { low: 0, high: 0 })
    : undefined;

  const missing: BenefitSummary["missing"] = [];
  if (situation.monthlyIncome === undefined) missing.push("income");
  if (situation.householdSize === undefined) missing.push("householdSize");
  if (situation.monthlyHousingCost === undefined && calFresh) missing.push("rent");

  return { estimates, monthlyTotal, figuresLabel: y.label, missing };
}
