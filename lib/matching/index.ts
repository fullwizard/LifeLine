/**
 * lib/matching — pure, deterministic matching engine.
 *
 * Pipeline: gates → score → rank. Imports nothing from Next.js, Gemini, or
 * any data source; callers pass plain data in and get plain data out.
 */
import type { MatchContext, MatchResult, Resource, ResourceCategory, Situation } from "../types";
import { applyGates } from "./gates";
import { rank } from "./rank";
import { scoreResource } from "./score";

export function matchResources(
  resources: Resource[],
  situation: Situation,
  context: MatchContext = {},
): MatchResult {
  const { survivors, excluded } = applyGates(resources, situation, context);
  const { requested, related } = splitByNeeds(survivors, situation.needs);
  const ranked = rank(requested.map((r) => scoreResource(r, situation, context)));
  const relatedRanked = rank(related.map((r) => scoreResource(r, situation, context))).slice(0, RELATED_LIMIT);
  return { ranked, related: relatedRanked, excluded };
}

/** How many "also worth knowing" resources to surface. */
export const RELATED_LIMIT = 6;

/**
 * Categories that usually matter alongside a stated need. Someone asking for
 * rent help is rarely served by a rent program alone.
 */
export const RELATED_NEEDS: Record<ResourceCategory, ResourceCategory[]> = {
  rental_assistance: ["legal", "utility", "benefits", "food"],
  shelter: ["rental_assistance", "food", "health", "mental_health"],
  legal: ["rental_assistance", "benefits"],
  utility: ["benefits", "rental_assistance"],
  food: ["benefits", "family_support"],
  employment: ["benefits", "food"],
  benefits: ["food", "utility", "health"],
  family_support: ["food", "benefits", "health"],
  veteran_support: ["rental_assistance", "shelter", "benefits", "health"],
  older_adult_support: ["benefits", "health", "food"],
  disability: ["benefits", "health"],
  mental_health: ["health", "substance_use"],
  substance_use: ["mental_health", "health"],
  condition_support: ["health", "disability"],
  health: ["benefits"],
};

/**
 * Split survivors into the categories the person asked for and the categories
 * related to those. With no stated need, everything is "requested" and nothing
 * is related, because there is nothing to relate to yet.
 */
export function splitByNeeds(
  resources: Resource[],
  needs: ResourceCategory[] | undefined,
): { requested: Resource[]; related: Resource[] } {
  if (!needs?.length) return { requested: resources, related: [] };
  const requested = new Set(needs);
  const relatedCategories = new Set(needs.flatMap((n) => RELATED_NEEDS[n] ?? []).filter((c) => !requested.has(c)));
  return {
    requested: resources.filter((r) => requested.has(r.category)),
    related: resources.filter((r) => relatedCategories.has(r.category)),
  };
}

/**
 * Once someone names a need, keep the results focused on that need. An empty
 * need list still means "show the broad pool" because the person has not told
 * us what to filter for yet.
 */
export function filterByNeeds(resources: Resource[], needs: ResourceCategory[] | undefined): Resource[] {
  return splitByNeeds(resources, needs).requested;
}

export { applyGates, runGates } from "./gates";
export { scoreResource, WEIGHTS } from "./score";
export { rank, unverifiedCount } from "./rank";
export { evaluateServiceArea } from "./location";
export { evaluateIncome } from "./income";
