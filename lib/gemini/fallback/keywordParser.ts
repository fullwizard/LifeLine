/**
 * Keyword-based situation parser. Deterministic, no network. Used when
 * Gemini is not configured or fails.
 */
import { resolvePlace } from "../../data/places";
import type { HousingStatus, ResourceCategory, Situation } from "../../types";
import type { ParseResult, SituationParser } from "../types";

const NEED_KEYWORDS: Record<ResourceCategory, RegExp> = {
  rental_assistance: /\b(rent|rental|landlord|lease|deposit|move[- ]in|back rent|behind on)\b/i,
  food: /\b(food|grocer(y|ies)|hungry|eat|snap|ebt|meals?)\b/i,
  utility: /\b(utilit(y|ies)|electric(ity)?|power|gas bill|heat(ing)?|water bill|shut[- ]?off|disconnect)\b/i,
  shelter: /\b(shelter|nowhere to (go|stay|sleep)|sleeping in|homeless|on the street|couch[- ]?surf)\b/i,
  employment: /\b(job|jobs|work|employment|unemployed|laid off|lost my job|hiring|income)\b/i,
  legal: /\b(court|lawyer|attorney|legal|lawsuit|sued|summons|unlawful detainer)\b/i,
};

function detectHousingStatus(t: string): HousingStatus | undefined {
  if (/\b(eviction notice|notice to vacate|pay or vacate|pay-or-vacate|being evicted|evict(ed|ion)|unlawful detainer|court date)\b/i.test(t)) {
    return "eviction_notice";
  }
  if (/\b(homeless|unhoused|sleeping in (my )?(car|van|truck)|on the street|in a shelter|couch[- ]?surf|nowhere to (go|stay|sleep))\b/i.test(t)) {
    return "unhoused";
  }
  if (/\b(behind on|late on|can'?t (pay|afford|make)|missed|owe|past due|late rent|short on rent|lose (my|our) (apartment|home|housing|place))\b/i.test(t)) {
    return "housed_at_risk";
  }
  return undefined;
}

function detectChildren(t: string): boolean | undefined {
  if (/\b(no kids|no children|don'?t have (any )?(kids|children)|childless)\b/i.test(t)) return false;
  if (/\b(kid|kids|child|children|son|daughter|baby|toddler|infant|my \d+[- ]year[- ]old)\b/i.test(t)) return true;
  return undefined;
}

function detectVeteran(t: string): boolean | undefined {
  if (/\b(not a veteran|never served|no military)\b/i.test(t)) return false;
  if (/\b(veteran|vet\b|served in the (army|navy|marines|air force|military)|military service|army|navy|marine corps|air force)\b/i.test(t)) return true;
  return undefined;
}

function detectIncome(t: string): number | undefined {
  // "$2,400 a month", "make 2400/month", "earn about $600 a week", "$45k a year"
  const m = t.match(/\$?\s?(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:\/|a|per|each)?\s*(month|mo\b|week|wk\b|year|yr\b|annually|hour|hr\b)/i);
  if (!m) return undefined;
  let n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return undefined;
  if (m[2]) n *= 1000;
  const unit = m[3].toLowerCase();
  if (unit.startsWith("week") || unit.startsWith("wk")) return Math.round(n * 52 / 12);
  if (unit.startsWith("year") || unit.startsWith("yr") || unit.startsWith("ann")) return Math.round(n / 12);
  if (unit.startsWith("hour") || unit.startsWith("hr")) return Math.round(n * 40 * 52 / 12);
  return Math.round(n);
}

function detectHouseholdSize(t: string): number | undefined {
  const m =
    t.match(/\b(family|household) of (\d+)\b/i) ??
    t.match(/\b(\d+) (people|persons|of us) (in|at) (my|our|the) (house|home|apartment|household)\b/i);
  if (m) {
    const n = Number(m[2] ?? m[1]);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
  const words: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6 };
  const w = t.match(/\b(family|household) of (two|three|four|five|six)\b/i);
  if (w) return words[w[2].toLowerCase()];
  if (/\b(just me|by myself|live alone|on my own|single)\b/i.test(t)) return 1;
  return undefined;
}

export function parseSituationByKeywords(text: string): Situation {
  const t = text.trim();
  const situation: Situation = { rawText: t };

  const location = resolvePlace(t);
  if (location) situation.location = location;

  const needs = (Object.keys(NEED_KEYWORDS) as ResourceCategory[]).filter((c) => NEED_KEYWORDS[c].test(t));
  const housingStatus = detectHousingStatus(t);
  if (housingStatus) situation.housingStatus = housingStatus;
  // Losing housing implies rent help (and legal help if a notice is involved).
  if (housingStatus === "eviction_notice") {
    if (!needs.includes("rental_assistance")) needs.push("rental_assistance");
    if (!needs.includes("legal")) needs.push("legal");
  } else if (housingStatus === "housed_at_risk" && !needs.includes("rental_assistance")) {
    needs.push("rental_assistance");
  } else if (housingStatus === "unhoused" && !needs.includes("shelter")) {
    needs.push("shelter");
  }
  if (needs.length) situation.needs = needs;

  const hasChildren = detectChildren(t);
  if (hasChildren !== undefined) situation.hasChildren = hasChildren;
  const isVeteran = detectVeteran(t);
  if (isVeteran !== undefined) situation.isVeteran = isVeteran;
  const monthlyIncome = detectIncome(t);
  if (monthlyIncome !== undefined) situation.monthlyIncome = monthlyIncome;
  const householdSize = detectHouseholdSize(t);
  if (householdSize !== undefined) situation.householdSize = householdSize;

  return situation;
}

export const keywordParser: SituationParser = {
  async parse(text: string): Promise<ParseResult> {
    return { situation: parseSituationByKeywords(text), provider: "fallback" };
  },
};
