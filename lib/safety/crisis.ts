/**
 * Deterministic safety screening. Pure function over text; no AI involved.
 *
 * Deliberately errs toward flagging: a false positive costs one extra screen,
 * a false negative could cost far more. Only an explicit denial is respected.
 */
import type { CrisisIndicator, Situation } from "../types";

const DIRECT_PHRASES =
  /\b(?:suicid\w*|kill(?:ing)? myself|end(?:ing)? (?:my life|it all|everything)|take (?:my|my own) life|(?:don't|do not|dont) want to (?:live|be alive|be here|wake up|go on) (?:anymore|any more)?|(?:want|wanted|wanting|wish(?:ed)?|ready) to (?:die|be dead|not exist|disappear forever)|better off dead|(?:hurt|harm|cut|cutting|hurting|harming) myself|self[- ]?harm|no reason to (?:live|go on|keep going)|(?:life )?(?:isn't|is not|not) worth living|can't go on|jump off (?:a|the) (?:bridge|building|roof)|overdose on purpose|thinking about (?:ending|dying|death))\b/i;

/**
 * Slang and euphemisms people actually type ("kms", "unalive"), plus ways of
 * saying it without the usual words. Each alternative avoids a common innocent
 * use: "10 kms", "end it with my boyfriend", "shoot myself in the foot".
 */
const SLANG_AND_EUPHEMISMS =
  /\b(?:(?<!\d\s?)kms|un-?aliv(?:e|ed|es|ing)|kill(?:ing)? my ?self|(?:off|end|hang|poison) myself|shoot myself(?! in the (?:foot|leg))|drown myself(?! in (?:work|my work|school|studying))|(?:want(?:ed)?|wanna|going|gonna|ready|planning|trying|thinking (?:of|about)) (?:to )?end(?:ing)? it(?!\s+with\b)|(?:no ?one|nobody)(?: would|'d| will) miss me|better off without me|wish(?:ed)? (?:i|that i) (?:was|were) never born|wish(?:ed)? (?:i|that i) (?:wouldn't|would not|didn't|did not|could never|would never|could just not) wake up|(?:don't|do not|dont) want to (?:exist|be around)|(?:want|wanna) to disappear|slit(?:ting)? my (?:wrists|throat)|(?:take|taking) all (?:of )?my pills)\b/i;

const SUICIDE_OR_SELF_HARM = new RegExp(`${DIRECT_PHRASES.source}|${SLANG_AND_EUPHEMISMS.source}`, "i");

/**
 * An explicit denial right before the phrase ("I am not suicidal", "no
 * thoughts of self-harm") does not trigger the screen. Anything looser does.
 */
const EXPLICIT_DENIAL = /(?:\b(?:not|never)\b|\bno (?:thoughts?|plans?|intention|desire|history) of)\s*(?:\w+\s+){0,2}$/i;

export function detectCrisisIndicators(text: string): CrisisIndicator[] {
  const t = text.replace(/[’‘]/g, "'");
  const out: CrisisIndicator[] = [];
  const g = new RegExp(SUICIDE_OR_SELF_HARM.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = g.exec(t))) {
    const prefix = t.slice(Math.max(0, m.index - 32), m.index);
    if (!EXPLICIT_DENIAL.test(prefix)) {
      out.push("suicide_or_self_harm");
      break;
    }
  }
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
