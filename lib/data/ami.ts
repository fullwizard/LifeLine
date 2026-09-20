/**
 * 100% Area Median Income (annual, 4-person household), approximate FY2025
 * HUD figures. Replace with a HUD income-limits lookup when moving to a
 * real data source. Keys are "<county>, <state>" lowercased; state keys are
 * a fallback.
 */
import type { Location } from "../types";

const AMI_BY_AREA: Record<string, number> = {
  "king county, wa": 161_300,
  "snohomish county, wa": 161_300,
  "pierce county, wa": 117_800,
  "spokane county, wa": 101_400,
  "clark county, wa": 121_400,
  wa: 110_000,
};

export function lookupAreaMedianIncome(loc: Location | undefined): number | undefined {
  if (!loc) return undefined;
  const state = loc.state?.trim().toLowerCase();
  const county = loc.county?.trim().toLowerCase();
  if (county && state) {
    const key = `${county.endsWith(" county") ? county : `${county} county`}, ${state}`;
    if (AMI_BY_AREA[key] !== undefined) return AMI_BY_AREA[key];
  }
  if (state && AMI_BY_AREA[state] !== undefined) return AMI_BY_AREA[state];
  return undefined;
}
