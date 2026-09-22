/**
 * lib/types.ts — the shared contract for LifeLine.
 *
 * Everything (matching engine, follow-up logic, AI adapters, UI) speaks in
 * these types. Keep this file free of runtime imports so it can be consumed
 * from pure modules and tests alike.
 */

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export type ResourceCategory =
  | "rental_assistance"
  | "food"
  | "utility"
  | "shelter"
  | "employment"
  | "legal"
  | "health"
  | "benefits"
  | "family_support"
  | "veteran_support"
  | "older_adult_support"
  | "disability"
  | "mental_health"
  | "substance_use"
  | "condition_support";

export const RESOURCE_CATEGORIES: readonly ResourceCategory[] = [
  "rental_assistance",
  "food",
  "utility",
  "shelter",
  "employment",
  "legal",
  "health",
  "benefits",
  "family_support",
  "veteran_support",
  "older_adult_support",
  "disability",
  "mental_health",
  "substance_use",
  "condition_support",
] as const;

export type HousingStatus =
  | "housed_stable" // housed, no immediate threat
  | "housed_at_risk" // behind on rent, notice threatened but not served
  | "eviction_notice" // formal notice / court filing received
  | "unhoused"; // sleeping in car, shelter, outside, or couch-surfing

export const HOUSING_STATUSES: readonly HousingStatus[] = [
  "housed_stable",
  "housed_at_risk",
  "eviction_notice",
  "unhoused",
] as const;

/**
 * Health conditions a person explicitly mentions. These are descriptive
 * context only; the matching engine does not use them to determine eligibility.
 */
export const REPORTED_CONDITIONS = [
  "disability",
  "mobility_impairment",
  "mental_health_condition",
  "substance_use_disorder",
  "diabetes",
  "cancer",
  "chronic_illness",
  "heart_disease",
  "kidney_disease",
  "respiratory_condition",
  "hiv_aids",
] as const;

export type ReportedCondition = (typeof REPORTED_CONDITIONS)[number];

/**
 * Structured eligibility rules for a resource. Every field is optional; an
 * absent field means "no requirement". Anything that cannot be expressed
 * structurally goes in `notes` and is always surfaced as "unverified".
 */
export interface Eligibility {
  /** Gross annual household income must be at or below this amount. */
  max_annual_income?: number;
  /** Household income must be at or below this % of Area Median Income. */
  max_ami_percent?: number;
  /** Household income must be at or below this % of the Federal Poverty Level. */
  max_fpl_percent?: number;
  /** Requires a formal eviction notice / court filing. */
  requires_eviction_notice?: boolean;
  /** Requires at least one minor child in the household. */
  requires_children?: boolean;
  /** Requires the applicant to be a veteran. */
  requires_veteran?: boolean;
  /** Applicant's housing status must be one of these. */
  housing_status_any_of?: HousingStatus[];
  /** Free-text conditions we cannot check. Always reported as unverified. */
  notes?: string;
}

export interface Resource {
  id: string;
  name: string;
  organization: string;
  category: ResourceCategory;
  description: string;
  /**
   * Areas served. Entries are one of:
   *   "US" (national), "California" (state), "Santa Clara County, CA" (county), "San Jose, CA" (city)
   */
  service_area: string[];
  active: boolean;
  eligibility: Eligibility;
  /** False when the source has not been reviewed for eligibility details. */
  eligibility_verified?: boolean;
  required_documents: string[];
  application_url: string;
  source_url: string;
  phone?: string;
  /** Optional until a verified address is geocoded. */
  lat?: number;
  lng?: number;
  /** Typical days from application to a decision or aid. */
  response_time_days?: number;
  /** ISO date the listing was last verified against the source. */
  last_verified?: string;
}

// ---------------------------------------------------------------------------
// Situations (what we know about the person asking)
// ---------------------------------------------------------------------------

export interface Location {
  city?: string;
  county?: string;
  zip?: string;
  lat?: number;
  lng?: number;
}

/**
 * A partial, possibly-incomplete description of someone's situation. Every
 * field is optional: unknown is a first-class state, distinct from false.
 */
export interface Situation {
  rawText?: string;
  location?: Location;
  householdSize?: number;
  /** Gross household income per month, USD. */
  monthlyIncome?: number;
  housingStatus?: HousingStatus;
  hasChildren?: boolean;
  isVeteran?: boolean;
  /** Categories of help the person asked for. Empty/undefined = unspecified. */
  needs?: ResourceCategory[];
  /** Documents the person says they already have on hand. */
  documentsAvailable?: string[];
  /** Health conditions or disabilities the person explicitly mentioned. */
  conditions?: ReportedCondition[];
  /**
   * Safety signals detected deterministically from the text. Never set by AI.
   * The UI must surface crisis resources before anything else when present.
   */
  crisisIndicators?: CrisisIndicator[];
}

export type CrisisIndicator = "suicide_or_self_harm";

/** Situation fields the follow-up engine may ask about. */
export type AskableField =
  | "location"
  | "householdSize"
  | "monthlyIncome"
  | "housingStatus"
  | "hasChildren"
  | "isVeteran";

// ---------------------------------------------------------------------------
// Matching output
// ---------------------------------------------------------------------------

export type FactorStatus = "met" | "unmet" | "unverified";

export type ScoreFactor =
  | "service_area"
  | "need_match"
  | "urgency_fit"
  | "income_limit"
  | "eviction_notice"
  | "children"
  | "veteran"
  | "housing_status"
  | "other_conditions"
  | "documents"
  | "distance";

export interface BreakdownItem {
  factor: ScoreFactor;
  status: FactorStatus;
  /** Points this factor contributed to the total. */
  points: number;
  /** Human-readable explanation, safe to show directly in the UI. */
  detail: string;
}

export interface ScoredResource {
  resource: Resource;
  score: number;
  breakdown: BreakdownItem[];
  /** True if any breakdown item is "unverified" — the org must confirm. */
  needsVerification: boolean;
}

export type GateName =
  | "active"
  | "service_area"
  | "income_limit"
  | "eviction_notice"
  | "children"
  | "veteran"
  | "housing_status";

export interface GateFailure {
  gate: GateName;
  detail: string;
}

export interface ExcludedResource {
  resource: Resource;
  failures: GateFailure[];
}

/** Local reference data the engine needs but must not fetch itself. */
export interface MatchContext {
  /** 100% Area Median Income, annual USD, for a 4-person household. */
  areaMedianIncomeAnnual?: number;
}

export interface MatchResult {
  ranked: ScoredResource[];
  excluded: ExcludedResource[];
}

// ---------------------------------------------------------------------------
// Follow-up questions
// ---------------------------------------------------------------------------

export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  field: AskableField;
  prompt: string;
  inputType: "text" | "number" | "select" | "boolean";
  options?: QuestionOption[];
  /** Average number of current candidates an answer would eliminate. */
  expectedEliminations: number;
  /** Why we are asking, in plain language. */
  rationale: string;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export interface Plan {
  situation: Situation;
  ranked: ScoredResource[];
  excludedCount: number;
  /** Short, readable overview of the plan. */
  summary: string;
  /** Ordered next steps, one per line. */
  steps: string[];
  /** Per-resource prose, keyed by resource id. */
  resourceNotes: Record<string, string>;
  /** Which explainer produced the prose. */
  generatedBy: "gemini" | "fallback";
  /** Which parser produced the structured situation. */
  parsedBy: "gemini" | "fallback";
  disclaimer: string;
}
