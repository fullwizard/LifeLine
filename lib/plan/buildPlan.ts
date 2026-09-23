/**
 * Orchestration: data → deterministic matching → AI prose. This is the only
 * place that wires the layers together.
 */
import { lookupAreaMedianIncome } from "../data/ami";
import { getResources } from "../data/resources";
import { nextQuestion } from "../followup/nextQuestion";
import { explainPlan } from "../gemini/explainPlan";
import { matchResources } from "../matching";
import type { MatchContext, Plan, Question, Situation } from "../types";

export const DISCLAIMER =
  "LifeLine does not decide who qualifies. Items marked \"confirmed\" match what you told us; items marked \"needs verification\" must be checked with the organization. Program details change — confirm before relying on them.";

export function contextFor(situation: Situation): MatchContext {
  return { areaMedianIncomeAnnual: lookupAreaMedianIncome(situation.location) };
}

export async function findNextQuestion(situation: Situation): Promise<{ question: Question | null; candidateCount: number }> {
  const resources = await getResources();
  const context = contextFor(situation);
  const { ranked } = matchResources(resources, situation, context);
  const candidates = ranked.map((r) => r.resource);
  return { question: nextQuestion(situation, candidates, context), candidateCount: candidates.length };
}

export async function buildPlan(situation: Situation, parsedBy: Plan["parsedBy"]): Promise<Plan> {
  const resources = await getResources();
  const context = contextFor(situation);
  const { ranked, related, excluded } = matchResources(resources, situation, context);
  const explanation = await explainPlan(situation, ranked);
  return {
    situation,
    ranked,
    related,
    excludedCount: excluded.length,
    summary: explanation.summary,
    steps: explanation.steps,
    resourceNotes: explanation.resourceNotes,
    generatedBy: explanation.provider,
    parsedBy,
    disclaimer: DISCLAIMER,
  };
}
