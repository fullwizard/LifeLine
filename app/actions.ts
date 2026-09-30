"use server";

import { resolvePlace } from "@/lib/data/places";
import { applyAnswer } from "@/lib/followup/nextQuestion";
import { parseSituation } from "@/lib/gemini/parseSituation";
import { buildPlan, findNextQuestion } from "@/lib/plan/buildPlan";
import { isLang, type Lang } from "@/lib/i18n";
import { RESOURCE_CATEGORIES, type AskableField, type Plan, type Question, type ResourceCategory, type Situation } from "@/lib/types";

export interface ParseResponse {
  situation: Situation;
  parsedBy: Plan["parsedBy"];
  question: Question | null;
  candidateCount: number;
}

export type ContinueResponse = ParseResponse | { plan: Plan };

const MAX_INPUT = 4000;

function langOf(value: unknown): Lang {
  return isLang(value) ? value : "en";
}

/** Needs the person tapped, merged ahead of the ones we read from their words. */
function withPickedNeeds(situation: Situation, picked: readonly string[] | undefined): Situation {
  const valid = (picked ?? []).filter((n): n is ResourceCategory => RESOURCE_CATEGORIES.includes(n as ResourceCategory));
  if (!valid.length) return situation;
  return { ...situation, needs: Array.from(new Set([...valid, ...(situation.needs ?? [])])) };
}

export async function parseAndAsk(text: string, pickedNeeds?: string[]): Promise<ParseResponse> {
  const trimmed = text.trim().slice(0, MAX_INPUT);
  if (!trimmed && !pickedNeeds?.length) throw new Error("Please describe your situation first.");
  const parsed = trimmed ? await parseSituation(trimmed) : { situation: {} as Situation, provider: "fallback" as const };
  const situation = withPickedNeeds(parsed.situation, pickedNeeds);
  const { question, candidateCount } = await findNextQuestion(situation);
  return { situation, parsedBy: parsed.provider, question, candidateCount };
}

/** Replace the list of needs after the person corrects what we understood. */
export async function updateNeeds(situation: Situation, needs: string[]): Promise<{ situation: Situation; candidateCount: number }> {
  const valid = needs.filter((n): n is ResourceCategory => RESOURCE_CATEGORIES.includes(n as ResourceCategory));
  const updated: Situation = { ...situation, needs: valid };
  const { candidateCount } = await findNextQuestion(updated);
  return { situation: updated, candidateCount };
}

export async function answerAndBuildPlan(
  situation: Situation,
  parsedBy: Plan["parsedBy"],
  answer: { field: AskableField; value: string } | null,
  lang?: string,
): Promise<Plan> {
  const updated = answer ? applyAnswer(situation, answer.field, answer.value, resolvePlace) : situation;
  return buildPlan(updated, parsedBy, langOf(lang));
}

/** Apply several answers at once (from the plan page) and rebuild the plan. */
export async function refinePlan(
  situation: Situation,
  parsedBy: Plan["parsedBy"],
  answers: { field: AskableField; value: string }[],
  lang?: string,
): Promise<Plan> {
  const updated = answers.reduce((s, a) => applyAnswer(s, a.field, a.value, resolvePlace), situation);
  return buildPlan(updated, parsedBy, langOf(lang));
}

/** Continue the follow-up flow after an answered question. */
export async function answerAndContinue(
  situation: Situation,
  parsedBy: Plan["parsedBy"],
  answer: { field: AskableField; value: string },
  lang?: string,
): Promise<ContinueResponse> {
  const updated = applyAnswer(situation, answer.field, answer.value, resolvePlace);
  const { question, candidateCount } = await findNextQuestion(updated);
  if (question) return { situation: updated, parsedBy, question, candidateCount };
  return { plan: await buildPlan(updated, parsedBy, langOf(lang)) };
}
