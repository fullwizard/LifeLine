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
  const relevant = filterByNeeds(survivors, situation.needs);
  const scored = relevant.map((r) => scoreResource(r, situation, context));
  return { ranked: rank(scored), excluded };
}

/**
 * Once someone names a need, keep the results focused on that need. An empty
 * need list still means "show the broad pool" because the person has not told
 * us what to filter for yet.
 */
export function filterByNeeds(resources: Resource[], needs: ResourceCategory[] | undefined): Resource[] {
  if (!needs?.length) return resources;
  const requested = new Set(needs);
  return resources.filter((resource) => requested.has(resource.category));
}

export { applyGates, runGates } from "./gates";
export { scoreResource, WEIGHTS } from "./score";
export { rank, unverifiedCount } from "./rank";
export { evaluateServiceArea } from "./location";
export { evaluateIncome } from "./income";
