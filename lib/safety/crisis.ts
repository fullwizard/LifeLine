/**
 * Deterministic safety screening. Pure function over text; no AI involved.
 *
 * Deliberately errs toward flagging: a false positive costs one extra screen,
 * a false negative could cost far more. Negation is NOT applied.
 */
import type { CrisisIndicator, Situation } from "../types";

const SUICIDE_OR_SELF_HARM =
  /\b(?:suicid\w*|kill(?:ing)? myself|end(?:ing)? (?:my life|it all|everything)|take (?:my|my own) life|(?:don't|do not|dont) want to (?:live|be alive|be here|wake up|go on) (?:anymore|any more)?|(?:want|wanted|wanting|wish(?:ed)?|ready) to (?:die|be dead|not exist|disappear forever)|better off dead|(?:hurt|harm|cut|cutting|hurting|harming) myself|self[- ]?harm|no reason to (?:live|go on|keep going)|(?:life )?(?:isn't|is not|not) worth living|can't go on|jump off (?:a|the) (?:bridge|building|roof)|overdose on purpose|thinking about (?:ending|dying|death))\b/i;

export function detectCrisisIndicators(text: string): CrisisIndicator[] {
  const t = text.replace(/[’‘]/g, "'");
  const out: CrisisIndicator[] = [];
  if (SUICIDE_OR_SELF_HARM.test(t)) out.push("suicide_or_self_harm");
  return out;
}

/** Attach indicators to a parsed Situation, whichever parser produced it. */
export function withCrisisIndicators(situation: Situation, text: string): Situation {
  const found = detectCrisisIndicators(text);
  if (found.length === 0) return situation;
  const merged = Array.from(new Set([...(situation.crisisIndicators ?? []), ...found]));
  return { ...situation, crisisIndicators: merged };
}

export const CRISIS_LINE = {
  name: "988 Suicide & Crisis Lifeline",
  number: "988",
  tel: "tel:988",
  sms: "sms:988",
  infoUrl: "https://988lifeline.org/",
} as const;
