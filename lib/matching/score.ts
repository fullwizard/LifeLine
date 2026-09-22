/**
 * SCORING. Runs only on gate survivors. Returns a number plus a structured
 * breakdown explaining every point awarded (or withheld).
 *
 * Status semantics:
 *   met        — confirmed from what the person told us
 *   unmet      — known not to apply / not yet satisfied (but not disqualifying)
 *   unverified — cannot be confirmed from what we know; the org must verify
 */
import type {
  BreakdownItem,
  MatchContext,
  Resource,
  ScoredResource,
  Situation,
} from "../types";
import { humanStatus } from "./gates";
import { distanceMiles } from "./geo";
import { evaluateIncome } from "./income";
import { describeLocation, evaluateServiceArea, isNational, isStatewide } from "./location";

export const WEIGHTS = {
  service_area_confirmed: 15,
  need_match: 30,
  urgency_fit: 15,
  income_met: 20,
  income_none: 10,
  targeted_requirement_met: 10,
  documents_all: 10,
  distance_near: 10,
  distance_mid: 5,
} as const;

const URGENT_STATUSES = new Set(["eviction_notice", "unhoused"]);
const NEAR_MILES = 5;
const MID_MILES = 15;

export function scoreResource(
  resource: Resource,
  situation: Situation,
  context: MatchContext = {},
): ScoredResource {
  const b: BreakdownItem[] = [];
  const e = resource.eligibility;

  // --- service area (survived the gate; confirmed vs unverified) ------------
  const area = evaluateServiceArea(resource.service_area, situation.location);
  if (area.verdict === "match") {
    b.push({
      factor: "service_area",
      status: "met",
      points: WEIGHTS.service_area_confirmed,
      detail: `Serves your area (${area.matched}).`,
    });
  } else {
    b.push({
      factor: "service_area",
      status: "unverified",
      points: 0,
      detail: `Serves ${resource.service_area.join("; ")} — confirm this covers ${describeLocation(situation.location)}.`,
    });
  }

  // --- need match -----------------------------------------------------------
  const needs = situation.needs ?? [];
  if (needs.length === 0) {
    b.push({
      factor: "need_match",
      status: "unverified",
      points: 0,
      detail: "You did not specify what kind of help you need.",
    });
  } else if (needs.includes(resource.category)) {
    b.push({
      factor: "need_match",
      status: "met",
      points: WEIGHTS.need_match,
      detail: `Matches your request for ${humanCategory(resource.category)}.`,
    });
  } else {
    b.push({
      factor: "need_match",
      status: "unmet",
      points: 0,
      detail: `Provides ${humanCategory(resource.category)}, which you did not ask for.`,
    });
  }

  // --- urgency fit ----------------------------------------------------------
  if (situation.housingStatus === undefined) {
    b.push({
      factor: "urgency_fit",
      status: "unverified",
      points: 0,
      detail: "Your housing status is unknown, so urgency could not be assessed.",
    });
  } else if (URGENT_STATUSES.has(situation.housingStatus)) {
    const days = resource.response_time_days;
    if (days !== undefined && days <= 7) {
      b.push({
        factor: "urgency_fit",
        status: "met",
        points: WEIGHTS.urgency_fit,
        detail:
          days === 0
            ? "Available same day, which fits your urgent situation."
            : `Typically responds within ${days} day${days === 1 ? "" : "s"}, which fits your urgent situation.`,
      });
    } else if (days !== undefined) {
      b.push({
        factor: "urgency_fit",
        status: "unmet",
        points: 0,
        detail: `Typically takes about ${days} days, which may be too slow for your situation.`,
      });
    } else {
      // Most crawled listings do not publish a response-time promise. Do not
      // turn that missing optional field into a repeated warning on every card.
    }
  } else if (resource.response_time_days !== undefined) {
    b.push({
      factor: "urgency_fit",
      status: "met",
      points: 0,
      detail: "No immediate deadline, so response time is not critical.",
    });
  }

  // --- income limit ---------------------------------------------------------
  const income = evaluateIncome(e, situation, context.areaMedianIncomeAnnual);
  if (income.status === "none") {
    b.push({
      factor: "income_limit",
      status: "met",
      points: WEIGHTS.income_none,
      detail: "No income limit.",
    });
  } else if (income.status === "met") {
    b.push({ factor: "income_limit", status: "met", points: WEIGHTS.income_met, detail: income.detail });
  } else {
    // "unmet" never reaches scoring (gated); anything else is unverified.
    b.push({ factor: "income_limit", status: "unverified", points: 0, detail: income.detail });
  }

  // --- targeted requirements (each survived the gate) -----------------------
  if (e.requires_eviction_notice) {
    if (situation.housingStatus === "eviction_notice") {
      b.push({
        factor: "eviction_notice",
        status: "met",
        points: WEIGHTS.targeted_requirement_met,
        detail: "Requires an eviction notice — you have one.",
      });
    } else {
      b.push({
        factor: "eviction_notice",
        status: "unverified",
        points: 0,
        detail: "Requires a formal eviction notice — confirm whether yours qualifies.",
      });
    }
  }

  if (e.requires_children) {
    if (situation.hasChildren === true) {
      b.push({
        factor: "children",
        status: "met",
        points: WEIGHTS.targeted_requirement_met,
        detail: "For households with children — you have children.",
      });
    } else {
      b.push({
        factor: "children",
        status: "unverified",
        points: 0,
        detail: "Only for households with minor children — not confirmed.",
      });
    }
  }

  if (e.requires_veteran) {
    if (situation.isVeteran === true) {
      b.push({
        factor: "veteran",
        status: "met",
        points: WEIGHTS.targeted_requirement_met,
        detail: "For veterans — you are a veteran.",
      });
    } else {
      b.push({
        factor: "veteran",
        status: "unverified",
        points: 0,
        detail: "Only for veterans — veteran status not confirmed.",
      });
    }
  }

  if (e.housing_status_any_of) {
    const allowed = e.housing_status_any_of.map(humanStatus).join(" or ");
    if (situation.housingStatus !== undefined) {
      b.push({
        factor: "housing_status",
        status: "met",
        points: WEIGHTS.targeted_requirement_met,
        detail: `For people who are ${allowed} — matches your situation.`,
      });
    } else {
      b.push({
        factor: "housing_status",
        status: "unverified",
        points: 0,
        detail: `Only for people who are ${allowed} — your housing status is unknown.`,
      });
    }
  }

  if (e.notes) {
    b.push({
      factor: "other_conditions",
      status: "unverified",
      points: 0,
      detail: `Additional conditions to confirm with the organization: ${e.notes}`,
    });
  }

  // --- documents ------------------------------------------------------------
  if (resource.required_documents.length > 0) {
    if (situation.documentsAvailable === undefined) {
      b.push({
        factor: "documents",
        status: "unverified",
        points: 0,
        detail: `You will need: ${resource.required_documents.join(", ")}.`,
      });
    } else {
      const have = new Set(situation.documentsAvailable.map((d) => d.toLowerCase()));
      const missing = resource.required_documents.filter((d) => !have.has(d.toLowerCase()));
      if (missing.length === 0) {
        b.push({
          factor: "documents",
          status: "met",
          points: WEIGHTS.documents_all,
          detail: "You have all the required documents.",
        });
      } else {
        b.push({
          factor: "documents",
          status: "unmet",
          points: 0,
          detail: `Still needed: ${missing.join(", ")}.`,
        });
      }
    }
  }

  // --- distance -------------------------------------------------------------
  const loc = situation.location;
  if (isNational(resource)) {
    b.push({
      factor: "distance",
      status: "met",
      points: 0,
      detail: "Available by phone or online from anywhere.",
    });
  } else if (isStatewide(resource)) {
    b.push({
      factor: "distance",
      status: "met",
      points: 0,
      detail: "Available statewide; exact distance is not applicable.",
    });
  } else if (loc?.lat !== undefined && loc.lng !== undefined && resource.lat !== undefined && resource.lng !== undefined) {
    const miles = distanceMiles(loc.lat, loc.lng, resource.lat, resource.lng);
    const rounded = Math.round(miles * 10) / 10;
    const points = miles <= NEAR_MILES ? WEIGHTS.distance_near : miles <= MID_MILES ? WEIGHTS.distance_mid : 0;
    b.push({
      factor: "distance",
      status: "met",
      points,
      detail: `About ${rounded} miles from you.`,
    });
  } else {
    b.push({
      factor: "distance",
      status: "unverified",
      points: 0,
      detail: "Distance unknown — location not precise enough.",
    });
  }

  const score = b.reduce((sum, item) => sum + item.points, 0);
  return {
    resource,
    score,
    breakdown: b,
    needsVerification: b.some((item) => item.status === "unverified"),
  };
}

export function humanCategory(c: Resource["category"]): string {
  switch (c) {
    case "rental_assistance":
      return "rental assistance";
    case "food":
      return "food assistance";
    case "utility":
      return "utility bill help";
    case "shelter":
      return "emergency shelter";
    case "employment":
      return "employment help";
    case "legal":
      return "legal help";
    case "health":
      return "health care";
    case "benefits":
      return "public benefits";
    case "family_support":
      return "family support";
    case "veteran_support":
      return "veteran services";
    case "older_adult_support":
      return "older adult services";
    case "disability":
      return "disability services";
    case "mental_health":
      return "mental health support";
    case "substance_use":
      return "substance-use support";
    case "condition_support":
      return "condition-specific support";
  }
}
