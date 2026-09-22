"use server";

import { resolvePlace } from "@/lib/data/places";
import { applyAnswer } from "@/lib/followup/nextQuestion";
import { parseSituation } from "@/lib/gemini/parseSituation";
import { buildPlan, findNextQuestion } from "@/lib/plan/buildPlan";
import type { AskableField, Plan, Question, Situation } from "@/lib/types";

export interface ParseResponse {
  situation: Situation;
  parsedBy: Plan["parsedBy"];
  question: Question | null;
  candidateCount: number;
}

export type ContinueResponse = ParseResponse | { plan: Plan };

const MAX_INPUT = 4000;

export async function parseAndAsk(text: string): Promise<ParseResponse> {
  const trimmed = text.trim().slice(0, MAX_INPUT);
  if (!trimmed) throw new Error("Please describe your situation first.");
  const { situation, provider } = await parseSituation(trimmed);
  const { question, candidateCount } = await findNextQuestion(situation);
  return { situation, parsedBy: provider, question, candidateCount };
}

export async function answerAndBuildPlan(
  situation: Situation,
  parsedBy: Plan["parsedBy"],
  answer: { field: AskableField; value: string } | null,
): Promise<Plan> {
  const updated = answer ? applyAnswer(situation, answer.field, answer.value, resolvePlace) : situation;
  return buildPlan(updated, parsedBy);
}

/** Continue the follow-up flow after an answered question. */
export async function answerAndContinue(
  situation: Situation,
  parsedBy: Plan["parsedBy"],
  answer: { field: AskableField; value: string },
): Promise<ContinueResponse> {
  const updated = applyAnswer(situation, answer.field, answer.value, resolvePlace);
  const { question, candidateCount } = await findNextQuestion(updated);
  if (question) return { situation: updated, parsedBy, question, candidateCount };
  return { plan: await buildPlan(updated, parsedBy) };
}
