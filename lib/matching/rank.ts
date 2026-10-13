/**
 * RANK. Deterministic ordering of scored resources.
 *   1. higher score first
 *   2. fewer unverified eligibility factors first (more certainty wins ties)
 *   3. name, for a stable order
 */
import type { ScoredResource } from "../types";
import { isEligibilityUnverified } from "./score";

export function unverifiedCount(s: ScoredResource): number {
  return s.breakdown.filter(isEligibilityUnverified).length;
}

export function rank(scored: ScoredResource[]): ScoredResource[] {
  return [...scored].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ua = unverifiedCount(a);
    const ub = unverifiedCount(b);
    if (ua !== ub) return ua - ub;
    return a.resource.name.localeCompare(b.resource.name);
  });
}
