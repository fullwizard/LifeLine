/**
 * Keyword-based situation parser. Deterministic, no network. Used when
 * Gemini is not configured or fails.
 *
 * Principles:
 *   - Only extract what is stated. Unknown stays undefined.
 *   - Negation and hedging are respected at the clause level
 *     ("no eviction notice yet" is at-risk, not a notice).
 *   - Money is classified by context: rent and bills are expenses, not income.
 */
import { resolvePlace } from "../../data/places";
import {
  REPORTED_CONDITIONS,
  type HousingStatus,
  type ReportedCondition,
  type ResourceCategory,
  type Situation,
} from "../../types";
import type { ParseResult, SituationParser } from "../types";
import { looksSpanish, spanishToEnglish } from "./spanish";

// ---------------------------------------------------------------------------
// Text normalisation
// ---------------------------------------------------------------------------

const SMALL: Record<string, number> = {
  zero: 0, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const W = "(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)";

function wordGroup(s: string): number {
  return s.split(/[-\s]+/).reduce((sum, w) => sum + (SMALL[w] ?? 0), 0);
}

function toInt(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : (SMALL[s.toLowerCase()] ?? NaN);
}

/** "two thousand", "twenty-five hundred", "3k", "5 grand" → digits. */
function normalizeNumbers(text: string): string {
  let t = text;
  t = t.replace(
    new RegExp(`\\b(${W}(?:[-\\s]${W})?)\\s+(hundred|thousand|grand)\\b(?:\\s+(?:and\\s+)?(${W}(?:[-\\s]${W})?)\\s+hundred\\b)?`, "gi"),
    (_m, a: string, unit: string, b?: string) => {
      const base = wordGroup(a.toLowerCase()) * (unit.toLowerCase() === "hundred" ? 100 : 1000);
      return String(base + (b ? wordGroup(b.toLowerCase()) * 100 : 0));
    },
  );
  t = t.replace(/\b(\d+(?:\.\d+)?)\s*(?:k|grand)\b/gi, (_m, n: string) => String(Math.round(Number(n) * 1000)));
  return t;
}

function normalize(text: string): string {
  const base = looksSpanish(text) ? spanishToEnglish(text) : text;
  return normalizeNumbers(
    base
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/\bim\b/gi, "i'm")
      .replace(/\bcant\b/gi, "can't")
      .replace(/\bdont\b/gi, "don't")
      .replace(/\bwont\b/gi, "won't")
      .replace(/\bhavent\b/gi, "haven't")
      .replace(/\bdidnt\b/gi, "didn't")
      .replace(/\bisnt\b/gi, "isn't")
      .replace(/\bwasnt\b/gi, "wasn't")
      .replace(/\bdoesnt\b/gi, "doesn't")
      .replace(/\bcouldnt\b/gi, "couldn't")
      .replace(/\bw\/o\b/gi, "without")
      .replace(/\bw\/\s?/gi, "with ")
      .replace(/\b(?:bc|b\/c|cuz|cause)\b/gi, "because")
      .replace(/\btmrw\b|\btmr\b/gi, "tomorrow")
      .replace(/\bu\b/gi, "you")
      .replace(/\br\b/gi, "are")
      .replace(/\bn\b/gi, "and")
      .replace(/\bppl\b/gi, "people")
      .replace(/\bmo\b/gi, "month")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

/** Split into clauses so negation in one does not leak into the next. */
function clauses(t: string): string[] {
  return t
    .split(/(?<=[.!?;])\s+|\s*,\s*(?=\s*(?:but|and|so|then)\b)|\s+\bbut\b\s+/i)
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * "no kids", "not a veteran", "don't have insurance", "never served".
 * Deliberately NOT "can't afford groceries" or "can't pay rent": those assert
 * a need rather than deny one.
 */
const NEGATION_BEFORE =
  /(?:\b(?:no|not|never|without|nor|none of)\b|\b(?:don't|do not|doesn't|does not|didn't|did not|won't|haven't|have not|hasn't|isn't|aren't|ain't|can't|cannot) (?:have|need|want|got|get|receive|received|use|require|qualify for))\s*(?:a|an|any|the|my|our|more|even|really)?\s*(?:[\w-]+\s+)?$/i;

/** True if the match at `index` in `t` is preceded (closely) by a negation. */
function negatedAt(t: string, index: number): boolean {
  return NEGATION_BEFORE.test(t.slice(Math.max(0, index - 40), index));
}

/** First non-negated match of `re` in `t`, or null. */
function positiveMatch(t: string, re: RegExp): RegExpExecArray | null {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = g.exec(t))) {
    if (!negatedAt(t, m.index)) return m;
    if (m[0].length === 0) g.lastIndex++;
  }
  return null;
}

function has(t: string, re: RegExp): boolean {
  return positiveMatch(t, re) !== null;
}

// ---------------------------------------------------------------------------
// Housing status
// ---------------------------------------------------------------------------

const UNHOUSED =
  /\b(?:homeless|unhoused|(?:living|sleeping|staying|live|sleep|stay|been living|been sleeping) (?:in|out of) (?:my |a |the |our )?(?:car|van|truck|tent|rv|camper|vehicle)|on the streets?|(?:in|at) (?:a|an|the) (?:emergency |homeless )?shelter|couch[- ]?surf\w*|no ?where to (?:go|stay|sleep|live)|no place to (?:stay|live|sleep|go)|(?:staying|crashing|living|sleeping|been staying|been sleeping) (?:at|with|on) (?:a |my |our |his |her |their )?(?:friend|sister|brother|mom|mother|dad|father|parent|cousin|aunt|uncle|grandma|grandmother|grandpa|relative|family member|buddy|coworker)(?:'s)?|(?:in|at) a (?:motel|hotel)|lost (?:my|our|the) (?:apartment|place|housing|home|house)|(?:got|been|was|were|getting) (?:kicked|thrown|put) out|encampment|sleeping (?:outside|rough))\b/i;

const NOTICE =
  /\b(?:eviction notice|notice to (?:vacate|quit)|pay[- ]or[- ](?:vacate|quit)|(?:3|three|5|five|10|ten|14|30|60|90)[- ]day notice|(?:got|received|was served|got served|served|been served|handed|given|have|has) (?:a |an |the |my |our )?(?:eviction |written |formal |court )?notice|unlawful detainer|court date|court summons|summons|landlord (?:filed|is suing|sued)|filed (?:for )?(?:an )?eviction|sheriff|lock(?:ed)? ?out|(?:got|been|was|were|getting|being|am being|are being) evicted)\b/i;

const NOTICE_NEGATED =
  /\b(?:no|not|haven't|hasn't|didn't|never|without|before|not yet|nothing)\b[^.!?;]{0,30}\b(?:notice|evict\w*|court)\b|\b(?:notice|evict\w*)\b[^.!?;]{0,12}\byet\b/i;

const NOTICE_HEDGED =
  /\b(?:might|may|could|about to|going to|gonna|worried|afraid|scared|fear|threaten\w*|trying to|wants to|want to|is going to|at risk of|facing|possible|possibly|soon|if i|before i|avoid|prevent|stop)\b[^.!?;]{0,30}\bevict/i;

const AT_RISK =
  /\b(?:behind\b[^.!?;]{0,20}\b(?:rent|mortgage|payments)|(?:\d+|two|three|four) months? behind|late (?:on|with) (?:the |my |our )?rent|owe [^.!?;]{0,25}(?:rent|landlord)|back rent|past[- ]due rent|rent (?:is |was )?(?:past due|overdue|late|due|coming up)|(?:can't|cannot|can not|couldn't|unable to|won't be able to|not able to|struggling to|no way to) (?:pay|afford|cover|make|come up with|keep up with) [^.!?;]{0,15}(?:rent|mortgage|housing|apartment|place)|short on rent|(?:lose|losing|going to lose) (?:my|our|the) (?:apartment|home|housing|place|house)|hours (?:got |were |have been )?(?:cut|reduced|dropped)[^.!?;]{0,40}\brent|landlord (?:says|said|told|wants|is telling|keeps telling)[^.!?;]{0,40}\b(?:out|leave|move)|(?:have|need) to be out by|move out by)\b/i;

function detectHousingStatus(t: string): HousingStatus | undefined {
  let unhoused = false;
  let notice = false;
  let atRisk = false;
  for (const c of clauses(t)) {
    if (has(c, UNHOUSED)) unhoused = true;
    if (NOTICE_NEGATED.test(c) || NOTICE_HEDGED.test(c)) {
      atRisk = true;
    } else if (NOTICE.test(c)) {
      notice = true;
    }
    if (has(c, AT_RISK)) atRisk = true;
  }
  if (unhoused) return "unhoused";
  if (notice) return "eviction_notice";
  if (atRisk) return "housed_at_risk";
  return undefined;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const KID_WORD = "(?:kids?|children|child|sons?|daughters?|boys?|girls?|bab(?:y|ies)|toddlers?|infants?|teenagers?|teens?|little ones?|newborn)";
const KID_COUNT = new RegExp(`\\b(\\d+|${W}|a|an)\\s+(?:young |small |little |school[- ]age |minor )?${KID_WORD}\\b`, "gi");
const KID_MENTION = new RegExp(`\\b(?:my|our) (?:\\d+[- ]year[- ]old|${KID_WORD})\\b|\\b${KID_WORD}\\b|\\bsingle (?:mom|mother|dad|father|parent)\\b|\\b(?:mom|mother|dad|father|parent) of (?:\\d+|${W})\\b|\\b(?:child ?care|daycare|day care)\\b`, "i");
const KIDS_GROWN = /\b(?:grown|adult) (?:kids|children|son|daughter)|kids are (?:grown|adults)|children are (?:grown|adults)\b/i;
const NO_KIDS = /\b(?:no|without|don't have(?: any)?|do not have(?: any)?)\s+(?:kids|children|dependents)\b|\bchildless\b/i;

function detectChildren(t: string): boolean | undefined {
  if (NO_KIDS.test(t) || KIDS_GROWN.test(t)) return false;
  if (positiveMatch(t, KID_MENTION)) return true;
  return undefined;
}

function countKids(t: string): number | undefined {
  let total = 0;
  let found = false;
  const g = new RegExp(KID_COUNT.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = g.exec(t))) {
    if (negatedAt(t, m.index)) continue;
    const n = toInt(m[1]);
    if (Number.isFinite(n) && n > 0 && n < 15) {
      total += n;
      found = true;
    }
  }
  const parentOf = new RegExp(`\\b(?:single )?(?:mom|mother|mama|dad|father|parent) of (\\d+|${W})\\b`, "i").exec(t);
  if (parentOf) {
    const n = toInt(parentOf[1]);
    if (Number.isFinite(n) && n > 0 && n < 15) return found ? Math.max(total, n) : n;
  }
  if (found) return total;
  // "my daughter", "our baby" → one child. "my kids" → unknown count.
  if (new RegExp(`\\b(?:my|our) (?:\\d+[- ]year[- ]old|son|daughter|baby|toddler|infant|newborn|little one)\\b`, "i").test(t)) return 1;
  return undefined;
}

const PARTNER = /\b(?:my|our|with my|and my|me and my) (?:wife|husband|partner|spouse|boyfriend|girlfriend|fianc[ée]e?|bf|gf)\b/i;
const SINGLE_PARENT = /\bsingle (?:mom|mother|dad|father|parent)\b/i;
/** "my husband left", "we're separated", "my wife passed away": no partner in the home. */
const PARTNER_GONE =
  /\b(?:wife|husband|partner|spouse|boyfriend|girlfriend|bf|gf)\b[^.!?;]{0,25}\b(?:left|leaving|passed|died|moved out|walked out|kicked (?:me|us) out|is gone|in jail|in prison|deported)\b|\b(?:divorced|separated|widow(?:ed|er)?|getting a divorce)\b/i;
const ALONE = /\b(?:live alone|living alone|just me|by myself|on my own|only me|it's just me|no one else)\b/i;

function detectHouseholdSize(t: string): number | undefined {
  const explicit =
    new RegExp(`\\b(?:family|household|house) of (\\d+|${W})\\b`, "i").exec(t) ??
    new RegExp(`\\b(\\d+|${W}) (?:people|persons|of us|in (?:my|our|the) (?:house|home|apartment|household|family))\\b`, "i").exec(t) ??
    new RegExp(`\\b(?:there (?:are|is)|we are|we're) (\\d+|${W})(?: of us| people)?\\b`, "i").exec(t) ??
    new RegExp(`\\bhousehold (?:size )?(?:is|of) (\\d+|${W})\\b`, "i").exec(t);
  if (explicit) {
    const n = toInt(explicit[1]);
    if (Number.isFinite(n) && n > 0 && n < 20) return n;
  }

  // "N adults and M kids"
  const adultsKids = new RegExp(`\\b(\\d+|${W}) adults? and (\\d+|${W}) ${KID_WORD}\\b`, "i").exec(t);
  if (adultsKids) return toInt(adultsKids[1]) + toInt(adultsKids[2]);

  const kids = countKids(t);
  const partner = !SINGLE_PARENT.test(t) && !PARTNER_GONE.test(t) && has(t, PARTNER);
  const withParents = /\b(?:live|living|stay|staying|moved back) (?:in )?with my (?:parents|mom and dad)\b/i.test(t) ? 2
    : /\b(?:live|living|stay|staying|moved back) (?:in )?with my (?:mom|mother|dad|father)\b/i.test(t) ? 1 : 0;
  const RELATIVE = "(?:mom|mother|dad|father|grandma|grandmother|grandpa|grandfather|aunt|uncle|sister|brother|cousin|roommate|friend|nephew|niece)";
  const cohabitants =
    withParents > 0
      ? 0
      : countMatches(t, new RegExp(`\\b(?:my|our) ${RELATIVE} (?:and (?:i|me)\\b|(?:lives|is living|stays|is staying|moved in) with (?:me|us)\\b)|\\b(?:me and|i and) my ${RELATIVE}\\b`, "gi"));

  if (ALONE.test(t) && kids === undefined) return 1;

  const kidsMentioned = detectChildren(t) === true;
  if (kidsMentioned && kids === undefined) return undefined; // "my kids": count unknown
  if (kids === undefined && !partner && withParents === 0 && cohabitants === 0) return undefined;
  return 1 + (partner ? 1 : 0) + withParents + cohabitants + (kids ?? 0);
}

function countMatches(t: string, re: RegExp): number {
  let n = 0;
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  while (g.exec(t)) n++;
  return n;
}

const VETERAN_POSITIVE =
  /\b(?:veterans?|(?:i'm|i am|as|being|disabled|combat|retired|former) (?:a |an )?vet|vet (?:living|in|here|and|who|with|from|looking|needing)|served in the (?:army|navy|marines?|marine corps|air force|coast guard|military|national guard)|(?:i was|been|i've been) in the (?:army|navy|marines?|marine corps|air force|coast guard|military)|(?:army|navy|marine|marines|air force|coast guard) (?:veteran|vet)|military service|ex[- ]military|honorabl[ey] discharged|va benefits|va disability)\b/i;
const VETERAN_NEGATIVE = /\b(?:not a (?:veteran|vet)|never served|no military|not military|non[- ]veteran)\b/i;

function detectVeteran(t: string): boolean | undefined {
  if (VETERAN_NEGATIVE.test(t)) return false;
  if (positiveMatch(t, VETERAN_POSITIVE)) return true;
  return undefined;
}

function detectAge(t: string): number | undefined {
  const m =
    /\b(?:i'm|i am|age|aged|i'm turning)\s+(\d{2})\b(?!\s*(?:months|weeks|hours|%|k|,\d|\d))/i.exec(t) ??
    /(?<!\b(?:my|our|a|his|her)\s)\b(\d{2})[- ]years?[- ]old\b/i.exec(t) ??
    /\b(\d{2})\s*(?:yo|y\/o|yrs old)\b/i.exec(t);
  if (!m) return undefined;
  const n = Number(m[1]);
  return n >= 16 && n <= 105 ? n : undefined;
}

// ---------------------------------------------------------------------------
// Income
// ---------------------------------------------------------------------------

const EXPENSE_CUE = /\b(?:rent|lease|bill|bills|owe|owed|owing|deposit|behind|back rent|late fee|mortgage|cost|costs|costing|charging|charges|spend|spending|debt|utilities|pg&e|pge)\b/i;
const INCOME_CUE = /\b(?:make|makes|making|made|earn|earns|earning|earned|income|bring(?:s|ing)? (?:home|in)|take(?:s)? home|paid|paycheck|salary|wage|wages|get paid|gets paid|receive|receives|receiving|getting|get|gets|on (?:social security|ssi|ssdi|disability|unemployment|a pension|pension|retirement)|from (?:social security|ssi|ssdi|disability|unemployment|work|my job|a pension|retirement)|social security|pension|unemployment|combined|together|total|budget|living on|live on|support us on)\b/i;
const NO_INCOME = /\b(?:no|zero|without any|don't have any|not making any|no longer have any) (?:income|money|money coming in|paycheck|earnings)\b|\bnot working (?:right now|at all|anymore)\b|\bnot earning anything\b|\bbroke\b(?! down)/i;

const PERIOD = "(?:per|a|an|each|every|/)\\s*(month|mo|monthly|mth|week|wk|weekly|year|yr|annually|annual|hour|hr|hourly|paycheck|2 weeks|two weeks|biweekly|bi-weekly|fortnight)";
const MONEY = new RegExp(`(\\$\\s?)?(\\d[\\d,]*(?:\\.\\d+)?)(?:\\s*(?:dollars|bucks))?(?:\\s*${PERIOD})?`, "gi");

function periodToMonthly(amount: number, unit: string | undefined, hoursPerWeek: number): number {
  const u = (unit ?? "").toLowerCase();
  if (!u) return amount;
  if (u.startsWith("week") || u.startsWith("wk")) return (amount * 52) / 12;
  if (u.startsWith("year") || u.startsWith("yr") || u.startsWith("ann")) return amount / 12;
  if (u.startsWith("hour") || u.startsWith("hr")) return (amount * hoursPerWeek * 52) / 12;
  if (u.includes("week") || u.startsWith("bi") || u.startsWith("fort") || u === "paycheck") return (amount * 26) / 12;
  return amount;
}

function detectHoursPerWeek(t: string): { hours: number; stripped: string } {
  const re = /\b(\d{1,2})\s*(?:hours?|hrs?)?\s*(?:a|per|\/|each|every)\s*(?:week|wk)\b|\bhours (?:dropped|cut|down|went|reduced|are now)(?: down)? to (\d{1,2})\b|\b(\d{1,2}) hours? (?:a|per) week\b/i;
  const m = re.exec(t);
  if (!m) return { hours: 40, stripped: t };
  const n = Number(m[1] ?? m[2] ?? m[3]);
  const isHours = /\bhours?\b|\bhrs?\b/i.test(m[0]) || /\bhours?\b/i.test(t.slice(Math.max(0, m.index - 40), m.index));
  if (!isHours || !(n > 0 && n <= 80)) return { hours: 40, stripped: t };
  return { hours: n, stripped: t.slice(0, m.index) + " ".repeat(m[0].length) + t.slice(m.index + m[0].length) };
}

function detectIncome(t: string): number | undefined {
  if (NO_INCOME.test(t)) return 0;
  const { hours, stripped } = detectHoursPerWeek(t);

  type Candidate = { monthly: number; index: number; otherEarner: boolean };
  const candidates: Candidate[] = [];
  const g = new RegExp(MONEY.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = g.exec(stripped))) {
    const [, dollar, num, unit] = m;
    const raw = Number(num.replace(/,/g, ""));
    if (!Number.isFinite(raw) || raw <= 0) continue;
    const before = stripped.slice(Math.max(0, m.index - 45), m.index);
    const after = stripped.slice(m.index + m[0].length, m.index + m[0].length + 35);

    // Nearest cue before the number decides expense vs income.
    const lastExpense = lastIndex(before, EXPENSE_CUE);
    const lastIncome = lastIndex(before, INCOME_CUE);
    let kind: "income" | "expense" | "unknown" = "unknown";
    if (lastExpense >= 0 || lastIncome >= 0) kind = lastIncome > lastExpense ? "income" : "expense";
    if (kind === "unknown" && /^\s*(?:from|in (?:benefits|income|ssi|ssdi|social security)|income|combined|total|take[- ]home|after tax(?:es)?|a month from|from my job|(?:of |in )?(?:social security|ssi|ssdi|disability|unemployment|pension|retirement|calworks|child support|alimony))\b/i.test(after)) kind = "income";
    const hourly = /^(?:hour|hr)/i.test(unit ?? "");
    if (kind === "expense" && !hourly) continue;

    // Unlabelled numbers must look like money: a "$", a period, or a plausible amount.
    if (kind === "unknown" && !dollar && !unit) continue;
    if (kind === "income" && !dollar && !unit && !(raw >= 100 && raw <= 500_000)) continue;
    // A ZIP, year, or count is not money.
    if (!dollar && !unit && /^\d{5}$/.test(num)) continue;
    if (!dollar && !unit && (raw < 100 || raw > 500_000)) continue;

    let monthly: number;
    if (unit) monthly = periodToMonthly(raw, unit, hours);
    else if (raw >= 20_000) monthly = raw / 12; // "make 45000" reads as annual
    else monthly = raw;
    const otherEarner = /\b(?:wife|husband|partner|spouse|boyfriend|girlfriend|son|daughter|mom|dad|mother|father|roommate|he|she)\b[^.!?;]{0,20}$/i.test(before);
    candidates.push({ monthly: Math.round(monthly), index: m.index, otherEarner });
  }
  if (candidates.length === 0) return undefined;

  // First stated income, plus any amount attributed to another earner.
  const mine = candidates.find((c) => !c.otherEarner) ?? candidates[0];
  let total = mine.monthly;
  for (const c of candidates) {
    if (c !== mine && c.otherEarner) total += c.monthly;
  }
  return total;
}

/**
 * Monthly rent or mortgage, when stated: "rent is $2,100", "paying 1800 for
 * rent". Back rent and amounts owed are debts, not the monthly cost.
 */
function detectHousingCost(t: string): number | undefined {
  const re = new RegExp(
    `\\b(?:rent|mortgage)\\b(?: payment)?(?: is| was| of| costs?| runs?)?(?: about| around| like| roughly)?\\s*(\\$\\s?)?(\\d[\\d,]*)(?:\\s*${PERIOD})?|(?:pay|paying|spend|spending)(?: about| around| like)?\\s*(\\$\\s?)?(\\d[\\d,]*)(?:\\s*${PERIOD})?\\s*(?:a month\\s*)?(?:for|in|on) (?:my |our |the )?(?:rent|mortgage)\\b`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const before = t.slice(Math.max(0, m.index - 12), m.index);
    if (/\b(?:back|owe|owed|behind)\s*$/i.test(before)) continue;
    const num = Number((m[2] ?? m[5]).replace(/,/g, ""));
    const unit = m[3] ?? m[6];
    if (!(num >= 200 && num <= 20_000)) continue;
    return Math.round(periodToMonthly(num, unit, 40));
  }
  return undefined;
}

const UNEARNED_CUE = /\b(?:social security|ssi|ssdi|disability (?:check|benefits|payments?|income)|on disability|from disability|unemployment|edd|pension|retirement|calworks|cash aid|child support|alimony|general assistance|va (?:benefits|disability))\b/i;
const EARNED_CUE = /\b(?:make|makes|making|made|earn|earns|earning|paycheck|salary|wages?|hourly|an hour|per hour|\/hr|at work|my job|part[- ]time|full[- ]time|shifts?|self[- ]employed|gig|uber|lyft|doordash|instacart|tips)\b/i;

/** Whether the stated income comes from work, benefits, or both. */
function detectIncomeSource(t: string): Situation["incomeSource"] {
  const unearned = positiveMatch(t, UNEARNED_CUE) !== null;
  const earned = positiveMatch(t, EARNED_CUE) !== null && !/\b(?:lost|no|without) (?:my |a )?(?:job|work)\b|\blaid off\b|\bunemployed\b/i.test(t);
  if (earned && unearned) return "mixed";
  if (unearned) return "unearned";
  if (earned) return "earned";
  return undefined;
}

function lastIndex(s: string, re: RegExp): number {
  const g = new RegExp(re.source, "gi");
  let last = -1;
  let m: RegExpExecArray | null;
  while ((m = g.exec(s))) {
    last = m.index;
    if (m[0].length === 0) g.lastIndex++;
  }
  return last;
}

// ---------------------------------------------------------------------------
// Needs
// ---------------------------------------------------------------------------

const NEED_KEYWORDS: Record<ResourceCategory, RegExp> = {
  rental_assistance:
    /\b(?:rent|rental|landlord|lease|deposit|move[- ]in|back rent|behind on|eviction|evicted|housing (?:help|assistance|costs?)|keep (?:my|our) (?:apartment|place|housing|home)|(?:cheaper|affordable|low[- ]income|subsidized) (?:place|apartment|housing|home|unit)|(?:need|find|finding|looking for|search(?:ing)? for) (?:an? |new |another |cheaper )?(?:apartment|place to (?:rent|live)|housing)|overcrowded|section 8|housing voucher|mortgage|foreclos\w*)\b/i,
  food: /\b(?:food|grocer(?:y|ies)|hungry|hunger|starv\w*|nothing to eat|enough to eat|anything to eat|haven't eaten|skipping meals|meals?|feed (?:my|our|the) (?:kids|family|children|baby|son|daughter)|calfresh|snap|ebt|food stamps|food bank|pantry|wic|formula|diapers)\b/i,
  utility:
    /\b(?:utilit(?:y|ies)|pg ?& ?e|pge|electric(?:ity)?|power (?:bill|got|was|is|shut|cut|off)|lights (?:got |were |are )?(?:shut|cut|turned) off|gas bill|heat(?:ing)?|water bill|shut[- ]?off|disconnect(?:ed|ion|ing)?|energy bill|internet|wi-?fi|phone (?:bill|service)|cell (?:phone )?bill|propane|trash bill|sewer bill|liheap)\b/i,
  shelter:
    /\b(?:shelter|(?:place|somewhere|anywhere) to (?:sleep|stay|live)|nowhere to|no ?where to|homeless|unhoused|roof over|housing tonight|bed tonight)\b/i,
  employment:
    /\b(?:jobs?|(?:find|finding|looking for|need|get|got|lost|losing) (?:a |my |some )?(?:work|job)|employment|unemployed|laid off|let go|fired|out of work|hours (?:got |were |have been )?(?:cut|reduced|dropped)|hiring|resume|job training|worksource|worknet|can't find (?:a )?(?:job|work)|need (?:more )?hours|job search|(?:got )?out of (?:jail|prison)|reentry|re-entry|get to work)\b/i,
  legal:
    /\b(?:court|lawyer|attorney|legal|lawsuit|sued|suing|summons|unlawful detainer|eviction defense|tenant rights|my rights|restraining order|immigration|wage theft|unpaid wages|(?:boss|employer|job|company) (?:isn't|is not|won't|didn't|hasn't|never|stopped) pay\w*|(?:criminal )?record|expunge\w*|parole|probation|(?:got )?out of (?:jail|prison)|debt collectors?|garnish\w*|divorce|custody|deport\w*)\b/i,
  health:
    /\b(?:health insurance|health care|healthcare|medical|doctors?|clinic|hospital|medi[- ]?cal|medicaid|medicare|prescriptions?|medication|meds|dental|dentist|pregnan\w*|maternal|insurance lapsed|uninsured|covered california|medicines?|insulin|inhaler|glasses|eye (?:exam|doctor)|urgent care|emergency room|sick|injur(?:y|ed)|surgery)\b/i,
  benefits:
    /\b(?:benefits?|calworks|calfresh|ssi|ssdi|cash aid|cash assistance|general assistance|public assistance|financial (?:assistance|hardship|help)|finances? (?:are )?(?:starting to )?(?:slip|fall|falling apart)|apply for (?:aid|assistance)|food stamps|wic|unemployment(?: benefits| insurance| claim)?|edd|eitc|tax credit|social security|need (?:some )?(?:money|cash)|money is tight|tight on money|(?:can't|cannot) make ends meet|paycheck to paycheck|struggling financially|out of money|ran out of money|no money|broke(?! down)|transportation|ride to|bus pass|car (?:broke down|repair)|clothes|clothing)\b/i,
  family_support:
    /\b(?:child ?care|daycare|day care|domestic violence|abus(?:e|ive|ed)|pregnan\w*|foster|diapers|formula|parenting (?:help|class|support)|custody|newborn|head start|abusing|abuser|(?:hits?|hitting|beats?|beating|threaten\w*|stalk\w*|chok\w*) me|unsafe at home|clothes for (?:my |our )?(?:kids|children|son|daughter|baby)|school supplies|car seat|crib)\b/i,
  veteran_support: /\b(?:veterans?|va (?:benefits|disability|claim)|calvet|military)\b/i,
  older_adult_support: /\b(?:seniors?|older adults?|aging|elderly|retired|retirement|in[- ]home care|caregiver|caregiving|alzheimer'?s|dementia|memory)\b/i,
  disability: /\b(?:disabilit(?:y|ies)|disabled|ihss|developmental services|assistive|wheelchair|accessib\w+|autis\w+|special needs|regional center|blind|deaf|hard of hearing|down syndrome|cerebral palsy)\b/i,
  mental_health:
    /\b(?:mental health|behavioral health|depress(?:ed|ion)|anxiety|ptsd|counsel(?:ing|or)|therap(?:y|ist)|suicid\w*|self[- ]?harm(?:ing)?|(?:hurt|harm|kill)(?:ing)? myself|end(?:ing)? my life|bipolar|schizophreni\w*|panic attacks?|crisis line|psychiatrist|overwhelmed|(?:can't|cannot) cope|hopeless|trauma|grie(?:f|ving)|mental breakdown)\b/i,
  substance_use:
    /\b(?:substance (?:use|abuse)|addict(?:ed|ion)|(?:in )?recovery|relaps(?:e|ed|ing)|(?:recently )?off the wagon|rehab|detox|opioids?|fentanyl|meth(?:amphetamine)?|heroin|cocaine|sober|sobriety|drinking problem|alcoholi\w+|drug (?:use|problem))\b/i,
  condition_support:
    /\b(?:diabetes|diabetic|cancer|hiv|aids|heart (?:disease|failure|condition)|kidney (?:disease|failure)|dialysis|asthma|copd|chronic (?:illness|pain|condition)|epilepsy|seizures)\b/i,
};

const CONDITION_KEYWORDS: Record<ReportedCondition, RegExp> = {
  disability: /\b(?:disabled|disability|developmental disability|intellectual disability|on ssdi|autis\w+|down syndrome|cerebral palsy|blind|deaf)\b/i,
  mobility_impairment: /\b(?:wheelchair|mobility (?:impairment|issue|disability|problems?)|paraly[sz](?:ed|is)|amputee|walker|can't walk)\b/i,
  mental_health_condition: /\b(?:mental health|depression|depressed|anxiety|ptsd|bipolar|schizophreni\w*|self[- ]?harm(?:ing)?|suicid\w*|(?:hurt|harm|kill)(?:ing)? myself|end(?:ing)? my life)\b/i,
  substance_use_disorder: /\b(?:substance (?:use|abuse)|addict(?:ed|ion)|alcohol use disorder|drug use disorder|in recovery|relaps(?:e|ed|ing)|off the wagon|meth(?:amphetamine)?|fentanyl|cocaine|heroin|alcoholi\w+)\b/i,
  diabetes: /\b(?:diabetes|diabetic)\b/i,
  cancer: /\bcancer\b/i,
  chronic_illness: /\b(?:chronic illness|chronic condition|chronic pain|chronically ill)\b/i,
  heart_disease: /\b(?:heart disease|heart failure|heart condition|heart attack)\b/i,
  kidney_disease: /\b(?:kidney disease|renal disease|kidney failure|dialysis)\b/i,
  respiratory_condition: /\b(?:asthma|copd|emphysema|respiratory condition)\b/i,
  hiv_aids: /\b(?:hiv|aids)\b/i,
};

function detectConditions(t: string): ReportedCondition[] {
  return REPORTED_CONDITIONS.filter((condition) => positiveMatch(t, CONDITION_KEYWORDS[condition]) !== null);
}

/**
 * Denial of a need: "don't need food", "not homeless", "no eviction notice".
 * Unlike NEGATION_BEFORE, "no food" / "don't have insurance" / "without a job"
 * are needs, not denials: lacking something is exactly why people ask.
 */
const NEED_DENIAL_BEFORE =
  /(?:\b(?:don't|do not|doesn't|does not|didn't|did not|won't|no longer) (?:need|want|require|care about)|\bno need (?:for|of)|\bnot (?:looking for|asking for|worried about|in need of|seeking|about)|\b(?:not(?! enough)|never)(?: (?:a|an|really|currently|yet|actually))?)\s*(?:a|an|any|the|my|our|more|even|really)?\s*(?:[\w-]+\s+)?$/i;
/** Legal words where plain "no" is still a denial: "no eviction notice", "no court date". */
const LEGAL_WORD = /^(?:evict\w*|court|notice|summons|lawyer|attorney|unlawful detainer)/i;

function needNegatedAt(t: string, index: number, word: string): boolean {
  const before = t.slice(Math.max(0, index - 40), index);
  if (LEGAL_WORD.test(word)) return NEGATION_BEFORE.test(before) || /\b(?:no|not yet|haven't|hasn't|never)\b[^.!?;]{0,15}$/i.test(before);
  return NEED_DENIAL_BEFORE.test(before);
}

function needMentioned(t: string, re: RegExp): boolean {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = g.exec(t))) {
    if (!needNegatedAt(t, m.index, m[0])) return true;
    if (m[0].length === 0) g.lastIndex++;
  }
  return false;
}

function detectNeeds(t: string, facts: { housingStatus?: HousingStatus; isVeteran?: boolean; age?: number; conditions: ReportedCondition[] }): ResourceCategory[] {
  const needs = new Set<ResourceCategory>();
  for (const [category, re] of Object.entries(NEED_KEYWORDS) as [ResourceCategory, RegExp][]) {
    if (category === "veteran_support") continue; // decided by veteran status below
    for (const c of clauses(t)) {
      if (needMentioned(c, re)) {
        needs.add(category);
        break;
      }
    }
  }

  // Implied by housing status.
  if (facts.housingStatus === "eviction_notice") {
    needs.add("rental_assistance");
    needs.add("legal");
  } else if (facts.housingStatus === "housed_at_risk") {
    needs.add("rental_assistance");
  } else if (facts.housingStatus === "unhoused") {
    needs.add("shelter");
  }

  // Implied by who they are.
  if (facts.isVeteran === true) needs.add("veteran_support");
  if (facts.age !== undefined && facts.age >= 60) needs.add("older_adult_support");
  if (facts.conditions.includes("disability") || facts.conditions.includes("mobility_impairment")) needs.add("disability");
  if (facts.conditions.includes("mental_health_condition")) needs.add("mental_health");
  if (facts.conditions.includes("substance_use_disorder")) needs.add("substance_use");
  const medical: ReportedCondition[] = ["diabetes", "cancer", "chronic_illness", "heart_disease", "kidney_disease", "respiratory_condition", "hiv_aids"];
  if (facts.conditions.some((c) => medical.includes(c))) needs.add("condition_support");

  return Array.from(needs).sort((a, b) => NEED_PRIORITY.indexOf(a) - NEED_PRIORITY.indexOf(b));
}

/** Urgent, high-impact needs first when several are raised at once. */
const NEED_PRIORITY: ResourceCategory[] = [
  "mental_health",
  "substance_use",
  "shelter",
  "rental_assistance",
  "utility",
  "legal",
  "employment",
  "benefits",
  "family_support",
  "health",
  "disability",
  "condition_support",
  "food",
  "veteran_support",
  "older_adult_support",
];

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function parseSituationByKeywords(text: string): Situation {
  const raw = text.trim();
  const t = normalize(raw);
  const situation: Situation = { rawText: raw };

  const location = resolvePlace(raw) ?? resolvePlace(raw.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  if (location) situation.location = location;

  const housingStatus = detectHousingStatus(t);
  if (housingStatus) situation.housingStatus = housingStatus;

  const hasChildren = detectChildren(t);
  if (hasChildren !== undefined) situation.hasChildren = hasChildren;

  const isVeteran = detectVeteran(t);
  if (isVeteran !== undefined) situation.isVeteran = isVeteran;

  if (positiveMatch(t, /\b(?:pregnan\w*|expecting (?:a baby|our first|my first)|baby (?:is )?due|due in (?:january|february|march|april|may|june|july|august|september|october|november|december|\w+ (?:weeks|months)))\b/i)) {
    situation.isPregnant = true;
  }

  const monthlyIncome = detectIncome(t);
  if (monthlyIncome !== undefined) situation.monthlyIncome = monthlyIncome;

  const incomeSource = monthlyIncome !== undefined && monthlyIncome > 0 ? detectIncomeSource(t) : undefined;
  if (incomeSource) situation.incomeSource = incomeSource;

  const housingCost = detectHousingCost(t);
  if (housingCost !== undefined) situation.monthlyHousingCost = housingCost;

  const age = detectAge(t);
  if (age !== undefined) situation.age = age;

  const householdSize = detectHouseholdSize(t);
  if (householdSize !== undefined) situation.householdSize = householdSize;

  const conditions = detectConditions(t);
  if (conditions.length) situation.conditions = conditions;

  const needs = detectNeeds(t, { housingStatus, isVeteran, age, conditions });
  if (needs.length) situation.needs = needs;

  return situation;
}

export const keywordParser: SituationParser = {
  async parse(text: string): Promise<ParseResult> {
    return { situation: parseSituationByKeywords(text), provider: "fallback" };
  },
};
