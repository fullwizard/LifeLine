/**
 * lib/matching — pure, deterministic matching engine.
 *
 * Pipeline: gates → score → rank. Imports nothing from Next.js, Gemini, or
 * any data source; callers pass plain data in and get plain data out.
 */
import type { MatchContext, MatchResult, Resource, Situation } from "../types";
import { applyGates } from "./gates";
import { rank } from "./rank";
import { scoreResource } from "./score";

export function matchResources(
  resources: Resource[],
  situation: Situation,
  context: MatchContext = {},
): MatchResult {
  const { survivors, excluded } = applyGates(resources, situation, context);
  const scored = survivors.map((r) => scoreResource(r, situation, context));
  return { ranked: rank(scored), excluded };
}

export { applyGates, runGates } from "./gates";
export { scoreResource, WEIGHTS } from "./score";
export { rank, unverifiedCount } from "./rank";
export { evaluateServiceArea } from "./location";
export { evaluateIncome } from "./income";
