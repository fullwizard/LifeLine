/**
 * Published program figures the benefit estimator needs. Pure data.
 *
 * CalFresh (SNAP) figures change every October 1. Each year's set carries the
 * date it takes effect; `calFreshFigures(date)` picks the one in force, so the
 * October switch happens without a code change. Add next year's block when
 * USDA publishes its cost-of-living memo (usually August).
 */

export interface CalFreshYear {
  /** First day these figures apply (ISO date). */
  effective: string;
  label: string;
  /** Maximum monthly allotment by household size 1–8. */
  maxAllotment: [number, number, number, number, number, number, number, number];
  /** Added for each person beyond 8. */
  maxAllotmentEachAdditional: number;
  /** Standard deduction for sizes 1–3, 4, 5, 6+. */
  standardDeduction: { upTo3: number; four: number; five: number; sixPlus: number };
  /** Cap on the excess shelter deduction (no cap for elderly/disabled households). */
  shelterCap: number;
  /** Minimum benefit for eligible 1–2 person households. */
  minimumBenefit: number;
  /** Poverty guideline used for the 200% gross income test (California BBCE). */
  fpl: { base: number; perAdditional: number };
  source: string;
}

export const CALFRESH_YEARS: CalFreshYear[] = [
  {
    // USDA FNS, "SNAP – Fiscal Year 2026 Cost-of-Living Adjustments".
    effective: "2025-10-01",
    label: "Oct 2025 – Sep 2026",
    maxAllotment: [298, 546, 785, 994, 1183, 1421, 1571, 1789],
    maxAllotmentEachAdditional: 218,
    standardDeduction: { upTo3: 209, four: 223, five: 261, sixPlus: 299 },
    shelterCap: 744,
    minimumBenefit: 24,
    fpl: { base: 15_650, perAdditional: 5_500 }, // 2025 HHS guidelines
    source: "https://www.fna.usda.gov/snap/allotment/cola",
  },
  {
    // USDA FNS, "SNAP – Fiscal Year 2027 Cost-of-Living Adjustments" (Aug 21, 2026).
    effective: "2026-10-01",
    label: "Oct 2026 – Sep 2027",
    maxAllotment: [306, 562, 808, 1023, 1217, 1463, 1616, 1841],
    maxAllotmentEachAdditional: 225,
    standardDeduction: { upTo3: 217, four: 229, five: 268, sixPlus: 308 },
    shelterCap: 769,
    minimumBenefit: 25,
    fpl: { base: 15_960, perAdditional: 5_680 }, // 2026 HHS guidelines
    source: "https://www.fna.usda.gov/snap/allotment/cola/fy27",
  },
];

export function calFreshFigures(on: Date = new Date()): CalFreshYear {
  const iso = on.toISOString().slice(0, 10);
  const inForce = CALFRESH_YEARS.filter((y) => y.effective <= iso);
  return inForce[inForce.length - 1] ?? CALFRESH_YEARS[0];
}

/**
 * 2025 HHS poverty guidelines (48 states). CARE/FERA income limits for
 * June 2025 – May 2026 are 200% / 250% of these; Medi-Cal and WIC also use
 * multiples of the guideline. Using the earlier year is conservative: limits
 * only go up.
 */
export const FPL_2025 = { base: 15_650, perAdditional: 5_500 };

export function fplAnnual(size: number, pct: number, fpl = FPL_2025): number {
  const n = Math.max(1, Math.round(size));
  return (fpl.base + fpl.perAdditional * (n - 1)) * (pct / 100);
}

/** CalEITC: earned income must be at or below this (tax year 2025, FTB). */
export const CALEITC_MAX_EARNED = 32_900;

export const LINKS = {
  calfresh: { url: "https://www.getcalfresh.org/", phone: "1-877-847-3663" },
  calfreshRules: "https://www.cdss.ca.gov/inforesources/calfresh/eligibility-and-issuance-requirements",
  care: { url: "https://www.pge.com/care", phone: "1-866-743-2273" },
  fera: { url: "https://www.pge.com/fera", phone: "1-866-743-2273" },
  mediCal: { url: "https://www.dhcs.ca.gov/services/medi-cal/Pages/DoYouQualifyForMedi-Cal.aspx", phone: "1-800-541-5555" },
  coveredCa: "https://www.coveredca.com/",
  wic: { url: "https://myfamily.wic.ca.gov/", phone: "1-800-852-5770" },
  schoolMeals: "https://www.cde.ca.gov/ls/nu/sn/cauniversalmeals.asp",
  calEitc: "https://www.ftb.ca.gov/file/personal/credits/caleitc/index.html",
} as const;
