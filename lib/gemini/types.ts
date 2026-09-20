/**
 * Interfaces for the two (and only two) AI jobs in LifeLine:
 *   1. parse free text → structured Situation
 *   2. explain already-selected resources → readable prose
 *
 * AI never selects, ranks, or invents resources.
 */
import type { ScoredResource, Situation } from "../types";

export type Provider = "gemini" | "fallback";

export interface ParseResult {
  situation: Situation;
  provider: Provider;
}

export interface SituationParser {
  parse(text: string): Promise<ParseResult>;
}

export interface Explanation {
  summary: string;
  steps: string[];
  /** Keyed by resource id. Only ids that were passed in may appear. */
  resourceNotes: Record<string, string>;
  provider: Provider;
}

export interface PlanExplainer {
  explain(situation: Situation, ranked: ScoredResource[]): Promise<Explanation>;
}
