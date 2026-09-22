import type { Situation } from "./types";

const IMMEDIATE_SAFETY_LANGUAGE = /\b(self[-\s]?harm(?:ing)?|suicid(?:e|al|ality)|kill(?:ing)? myself|hurt(?:ing)? myself|harm(?:ing)? myself|end my life)\b/i;

/** True when the description contains a direct suicide or self-harm concern. */
export function hasImmediateSafetyConcern(situation: Pick<Situation, "rawText">): boolean {
  const text = situation.rawText ?? "";
  const match = IMMEDIATE_SAFETY_LANGUAGE.exec(text);
  if (!match || match.index === undefined) return false;

  // Do not interrupt someone who is explicitly denying a concern, such as
  // "I am not suicidal" or "no thoughts of self-harm".
  const prefix = text.slice(Math.max(0, match.index - 32), match.index);
  return !/(?:\bno\b|\bnot\b|\bwithout\b|\bnever\b|\bdon['’]?t\b|\bdo not\b)[^.!?]{0,24}$/i.test(prefix);
}
