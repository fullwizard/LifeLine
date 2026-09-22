/**
 * Income-limit evaluation against Area Median Income (AMI) and the Federal
 * Poverty Level (FPL). Pure arithmetic — reference figures are passed in.
 *
 * When household size is unknown we bracket: income at or below the 1-person
 * limit is "met" for any size; income above the 8-person limit is "unmet" for
 * any size; anything between is "unverified" (depends on household size).
 */
import type { Eligibility, Situation } from "../types";

/** HUD household-size adjustment factors relative to a 4-person household. */
const HUD_SIZE_FACTOR: Record<number, number> = {
  1: 0.7,
  2: 0.8,
  3: 0.9,
  4: 1.0,
  5: 1.08,
  6: 1.16,
  7: 1.24,
  8: 1.32,
};

/** 2025 HHS poverty guidelines (48 contiguous states), annual USD. */
const FPL_BASE = 15_650;
const FPL_PER_ADDITIONAL = 5_500;

export function amiLimitAnnual(ami4: number, householdSize: number, pct: number): number {
  const size = Math.min(Math.max(Math.round(householdSize), 1), 8);
  return ami4 * HUD_SIZE_FACTOR[size] * (pct / 100);
}

export function fplLimitAnnual(householdSize: number, pct: number): number {
  const size = Math.max(Math.round(householdSize), 1);
  return (FPL_BASE + FPL_PER_ADDITIONAL * (size - 1)) * (pct / 100);
}

export type IncomeVerdict =
  | { status: "none" } // resource has no income requirement
  | { status: "met"; detail: string }
  | { status: "unmet"; detail: string }
  | { status: "unverified"; detail: string };

function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function bracket(
  label: string,
  monthlyIncome: number | undefined,
  householdSize: number | undefined,
  limitFor: (size: number) => number,
): IncomeVerdict {
  if (monthlyIncome === undefined) {
    return { status: "unverified", detail: `${label} — your income was not provided.` };
  }
  const annual = monthlyIncome * 12;
  if (householdSize !== undefined) {
    const limit = limitFor(householdSize);
    if (annual <= limit) {
      return {
        status: "met",
        detail: `${label} — ${money(annual)}/yr is within the ${money(limit)}/yr limit for a household of ${householdSize}.`,
      };
    }
    return {
      status: "unmet",
      detail: `${label} — ${money(annual)}/yr exceeds the ${money(limit)}/yr limit for a household of ${householdSize}.`,
    };
  }
  const low = limitFor(1);
  const high = limitFor(8);
  if (annual <= low) {
    return { status: "met", detail: `${label} — ${money(annual)}/yr is under the limit for any household size.` };
  }
  if (annual > high) {
    return { status: "unmet", detail: `${label} — ${money(annual)}/yr exceeds the limit even for a large household.` };
  }
  return {
    status: "unverified",
    detail: `${label} — whether ${money(annual)}/yr qualifies depends on your household size (not provided).`,
  };
}

export function evaluateIncome(
  eligibility: Eligibility,
  situation: Situation,
  areaMedianIncomeAnnual: number | undefined,
  eligibilityVerified = true,
): IncomeVerdict {
  const { max_annual_income, max_ami_percent, max_fpl_percent } = eligibility;
  if (max_annual_income === undefined && max_ami_percent === undefined && max_fpl_percent === undefined) {
    return eligibilityVerified
      ? { status: "none" }
      : { status: "unverified", detail: "Income eligibility has not been verified from the source." };
  }

  const verdicts: IncomeVerdict[] = [];

  if (max_annual_income !== undefined) {
    const label = `Income limit ${money(max_annual_income)}/yr`;
    verdicts.push(
      bracket(label, situation.monthlyIncome, situation.householdSize, () => max_annual_income),
    );
  }

  if (max_ami_percent !== undefined) {
    const label = `Income limit ${max_ami_percent}% of Area Median Income`;
    if (areaMedianIncomeAnnual === undefined) {
      verdicts.push({ status: "unverified", detail: `${label} — area income figures unavailable for your location.` });
    } else {
      verdicts.push(
        bracket(label, situation.monthlyIncome, situation.householdSize, (size) =>
          amiLimitAnnual(areaMedianIncomeAnnual, size, max_ami_percent),
        ),
      );
    }
  }

  if (max_fpl_percent !== undefined) {
    const label = `Income limit ${max_fpl_percent}% of the Federal Poverty Level`;
    verdicts.push(
      bracket(label, situation.monthlyIncome, situation.householdSize, (size) =>
        fplLimitAnnual(size, max_fpl_percent),
      ),
    );
  }

  // Strictest verdict wins: any unmet → unmet; else any unverified → unverified.
  const unmet = verdicts.find((v) => v.status === "unmet");
  if (unmet) return unmet;
  const unverified = verdicts.find((v) => v.status === "unverified");
  if (unverified) return unverified;
  return verdicts[0];
}
