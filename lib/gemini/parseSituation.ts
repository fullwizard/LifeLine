/**
 * Situation parser. Uses Gemini when configured (GEMINI_API_KEY), otherwise
 * — or on any error — the deterministic keyword parser.
 */
import { resolvePlace } from "../data/places";
import { withCrisisIndicators } from "../safety/crisis";
import {
  HOUSING_STATUSES,
  REPORTED_CONDITIONS,
  RESOURCE_CATEGORIES,
  type HousingStatus,
  type ReportedCondition,
  type ResourceCategory,
  type Situation,
} from "../types";
import { generateJson, geminiEnabled } from "./client";
import { keywordParser } from "./fallback/keywordParser";
import type { ParseResult, SituationParser } from "./types";

interface GeminiSituation {
  locationText?: string | null;
  householdSize?: number | null;
  monthlyIncome?: number | null;
  housingStatus?: string | null;
  hasChildren?: boolean | null;
  isVeteran?: boolean | null;
  needs?: string[] | null;
  conditions?: string[] | null;
}

const SCHEMA = {
  type: "object",
  properties: {
    locationText: { type: "string", nullable: true, description: "City, county, or ZIP mentioned, verbatim" },
    householdSize: { type: "integer", nullable: true },
    monthlyIncome: { type: "number", nullable: true, description: "Gross household income per month in USD" },
    housingStatus: { type: "string", nullable: true, enum: [...HOUSING_STATUSES] },
    hasChildren: { type: "boolean", nullable: true },
    isVeteran: { type: "boolean", nullable: true },
    needs: { type: "array", nullable: true, items: { type: "string", enum: [...RESOURCE_CATEGORIES] } },
    conditions: { type: "array", nullable: true, items: { type: "string", enum: [...REPORTED_CONDITIONS] } },
  },
};

function buildPrompt(text: string): string {
  return [
    "You extract structured facts from a person's description of a housing crisis.",
    "Return ONLY facts that are explicitly stated or unambiguously implied. Use null for anything not stated.",
    "Never guess income, household size, or location.",
    "housingStatus: housed_stable (no threat), housed_at_risk (behind on rent / worried), eviction_notice (formal notice or court filing), unhoused (no housing).",
    "needs: the kinds of help they are asking for, from: " + RESOURCE_CATEGORIES.join(", ") + ".",
    "conditions: explicitly stated health conditions or disabilities, from: " + REPORTED_CONDITIONS.join(", ") + ". Never infer a condition from medications or circumstances.",
    "",
    "Description:",
    text,
  ].join("\n");
}

function toSituation(text: string, g: GeminiSituation): Situation {
  const s: Situation = { rawText: text };
  if (g.locationText) {
    const loc = resolvePlace(g.locationText) ?? resolvePlace(text);
    if (loc) s.location = loc;
  }
  if (typeof g.householdSize === "number" && g.householdSize >= 1) s.householdSize = Math.round(g.householdSize);
  if (typeof g.monthlyIncome === "number" && g.monthlyIncome >= 0) s.monthlyIncome = Math.round(g.monthlyIncome);
  if (g.housingStatus && HOUSING_STATUSES.includes(g.housingStatus as HousingStatus)) {
    s.housingStatus = g.housingStatus as HousingStatus;
  }
  if (typeof g.hasChildren === "boolean") s.hasChildren = g.hasChildren;
  if (typeof g.isVeteran === "boolean") s.isVeteran = g.isVeteran;
  if (Array.isArray(g.needs)) {
    const needs = g.needs.filter((n): n is ResourceCategory => RESOURCE_CATEGORIES.includes(n as ResourceCategory));
    if (needs.length) s.needs = needs;
  }
  if (Array.isArray(g.conditions)) {
    const conditions = g.conditions.filter((condition): condition is ReportedCondition =>
      REPORTED_CONDITIONS.includes(condition as ReportedCondition),
    );
    if (conditions.length) s.conditions = conditions;
  }
  return s;
}

export const geminiParser: SituationParser = {
  async parse(text: string): Promise<ParseResult> {
    const g = await generateJson<GeminiSituation>(buildPrompt(text), SCHEMA);
    return { situation: toSituation(text, g), provider: "gemini" };
  },
};

/** Default entry point: Gemini if configured, else keyword fallback. */
export async function parseSituation(text: string): Promise<ParseResult> {
  let result: ParseResult | undefined;
  if (geminiEnabled()) {
    try {
      result = await geminiParser.parse(text);
    } catch (err) {
      console.warn("[LifeLine] Gemini parse failed, using keyword fallback:", err);
    }
  }
  result ??= await keywordParser.parse(text);
  return { ...result, situation: withCrisisIndicators(result.situation, text) };
}
