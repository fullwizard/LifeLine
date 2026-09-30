/**
 * "Get ready" packet: turns a plan into what to do, in what order, what to
 * bring, and what to say on the phone.
 *
 * Pure: builds only from the Plan (already matched and ranked) and the
 * benefit estimates. No AI, no I/O, so it can run on the client and re-render
 * instantly when the language changes.
 */
import type { BenefitId, BenefitSummary } from "../benefits/estimate";
import { LINKS } from "../benefits/figures";
import { formatMoney, type Lang, type MessageKey, type T } from "../i18n";
import type { BreakdownItem, Plan, ScoredResource, Situation } from "../types";

export type StepWhen = "now" | "today" | "week" | "next";

export interface PacketStep {
  when: StepWhen;
  text: string;
  detail?: string;
  link?: { label: string; url: string };
  phone?: string;
}

export interface DocItem {
  key: string;
  label: string;
  /** Programs that ask for it. */
  forWhat: string[];
  tip?: string;
}

export interface CallScript {
  resourceId: string;
  name: string;
  phone?: string;
  url: string;
  opener: string;
  questions: string[];
}

export interface ReadyPacket {
  steps: PacketStep[];
  documents: DocItem[];
  calls: CallScript[];
  /** Plain text for SMS, email, or copy. */
  shareText: string;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

type DocKey =
  | "id"
  | "income"
  | "lease"
  | "rentOwed"
  | "notice"
  | "utilityBill"
  | "pgeAccount"
  | "address"
  | "ssn"
  | "birth"
  | "dd214"
  | "insurance"
  | "bank";

const DOC_PATTERNS: [DocKey, RegExp][] = [
  ["notice", /\b(?:eviction|notice to|pay or quit|3[- ]day|summons|unlawful detainer|court papers)\b/i],
  ["rentOwed", /\b(?:ledger|past[- ]due|rent owed|amount owed)\b/i],
  ["lease", /\b(?:lease|rental agreement)\b/i],
  ["utilityBill", /\b(?:utility|pg&?e|energy|electric|gas|water) (?:bill|statement|notice)|shut[- ]?off notice\b/i],
  ["income", /\b(?:income|pay ?stubs?|paychecks?|earnings|award letter|benefit(?:s)? letter|tax return|w-?2|1099|unemployment)\b/i],
  ["dd214", /\b(?:dd[- ]?214|discharge papers|military discharge)\b/i],
  ["ssn", /\b(?:social security (?:card|number)|ssn)\b/i],
  ["birth", /\bbirth certificates?\b/i],
  ["insurance", /\b(?:insurance card|medi-?cal card|medicare card|health (?:plan|insurance))\b/i],
  ["bank", /\bbank statements?\b/i],
  ["address", /\b(?:proof of (?:address|residen\w+)|residency|address)\b/i],
  ["id", /\b(?:photo id|\bid\b|identification|driver'?s licen[sc]e|passport|state id)\b/i],
];

function canonicalDoc(raw: string): DocKey | undefined {
  return DOC_PATTERNS.find(([, re]) => re.test(raw))?.[0];
}

const BENEFIT_DOCS: Partial<Record<BenefitId, DocKey[]>> = {
  calfresh: ["id", "income", "lease", "utilityBill"],
  medi_cal: ["id", "income", "address"],
  medi_cal_kids: ["birth", "income", "address"],
  care: ["pgeAccount"],
  fera: ["pgeAccount"],
  wic: ["id", "address", "income"],
};

function buildDocuments(plan: Plan, benefits: BenefitSummary, t: T, top: ScoredResource[]): DocItem[] {
  const byKey = new Map<string, DocItem>();
  const add = (key: string, label: string, program: string, tip?: string) => {
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.forWhat.includes(program)) existing.forWhat.push(program);
      return;
    }
    byKey.set(key, { key, label, forWhat: [program], ...(tip ? { tip } : {}) });
  };
  const s = plan.situation;

  if (s.housingStatus === "eviction_notice") add("notice", t("doc.notice"), t("doc.for.legal"), t("doc.notice.tip"));
  if (s.isVeteran) add("dd214", t("doc.dd214"), t("doc.for.veteran"));

  for (const e of benefits.estimates) {
    for (const key of BENEFIT_DOCS[e.id] ?? []) {
      if (key === "lease" && s.housingStatus === "unhoused") continue;
      add(key, t(`doc.${key}` as MessageKey), e.title, docTip(key, s, t));
    }
  }
  for (const r of top) {
    for (const raw of r.resource.required_documents) {
      const key = canonicalDoc(raw);
      if (key) add(key, t(`doc.${key}` as MessageKey), r.resource.name, docTip(key, s, t));
      else add(`raw:${raw.toLowerCase()}`, raw, r.resource.name);
    }
  }

  const order: string[] = ["notice", "id", "income", "lease", "rentOwed", "utilityBill", "pgeAccount", "address", "ssn", "birth", "dd214", "insurance", "bank"];
  return Array.from(byKey.values()).sort((a, b) => rank(a.key) - rank(b.key));
  function rank(k: string) {
    const i = order.indexOf(k);
    return i === -1 ? order.length : i;
  }
}

function docTip(key: DocKey, s: Situation, t: T): string | undefined {
  if (key === "address" && s.housingStatus === "unhoused") return t("doc.address.tipUnhoused");
  if (key === "income" && s.monthlyIncome === 0) return t("doc.income.tipNone");
  if (key === "income") return t("doc.income.tip");
  if (key === "id") return t("doc.id.tip");
  return undefined;
}

// ---------------------------------------------------------------------------
// Call scripts
// ---------------------------------------------------------------------------

function factsSentence(s: Situation, t: T, lang: Lang): string {
  const parts: string[] = [];
  const place = s.location?.city ?? s.location?.county;
  if (place) parts.push(t("call.fact.place", { place }));
  if (s.householdSize) parts.push(t(s.householdSize === 1 ? "call.fact.alone" : "call.fact.household", { n: s.householdSize }));
  if (s.monthlyIncome !== undefined) {
    parts.push(s.monthlyIncome === 0 ? t("call.fact.noIncome") : t("call.fact.income", { amount: formatMoney(s.monthlyIncome, lang) }));
  }
  if (s.housingStatus === "eviction_notice") parts.push(t("call.fact.notice"));
  else if (s.housingStatus === "housed_at_risk") parts.push(t("call.fact.behind"));
  else if (s.housingStatus === "unhoused") parts.push(t("call.fact.unhoused"));
  if (s.isVeteran) parts.push(t("call.fact.veteran"));
  return parts.join(" ");
}

const FACTOR_QUESTION: Partial<Record<BreakdownItem["factor"], MessageKey>> = {
  service_area: "call.q.area",
  income_limit: "call.q.income",
  housing_status: "call.q.housing",
  eviction_notice: "call.q.notice",
  children: "call.q.children",
  veteran: "call.q.veteran",
  other_conditions: "call.q.other",
};

function buildCall(r: ScoredResource, s: Situation, t: T, lang: Lang): CallScript {
  const facts = factsSentence(s, t, lang);
  const place = s.location?.city ?? s.location?.county ?? "";
  const questions: string[] = [];
  for (const b of r.breakdown) {
    const key = b.status === "unverified" ? FACTOR_QUESTION[b.factor] : undefined;
    if (key) {
      const q = t(key, { place, size: s.householdSize ?? "" });
      if (!questions.includes(q)) questions.push(q);
    }
  }
  questions.push(t("call.q.docs"), t("call.q.time"), t("call.q.waitlist"), t("call.q.else"));
  return {
    resourceId: r.resource.id,
    name: r.resource.name,
    phone: r.resource.phone,
    url: r.resource.application_url,
    opener: t("call.opener", { program: r.resource.name, facts: facts ? ` ${facts}` : "" }).trim(),
    questions,
  };
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function buildSteps(plan: Plan, benefits: BenefitSummary, calls: CallScript[], t: T): PacketStep[] {
  const s = plan.situation;
  const steps: PacketStep[] = [];
  const has = (id: BenefitId) => benefits.estimates.some((e) => e.id === id);
  const needs = s.needs ?? [];

  if (s.crisisIndicators?.length) steps.push({ when: "now", text: t("step.crisis"), phone: "988" });
  if (needs.includes("family_support") && /\b(?:abus|hits? me|beat|violen|unsafe)/i.test(s.rawText ?? "")) {
    steps.push({ when: "now", text: t("step.dv"), phone: "1-800-799-7233" });
  }
  if (s.housingStatus === "eviction_notice") {
    steps.push({
      when: "today",
      text: t("step.eviction"),
      detail: t("step.eviction.detail"),
      link: { label: t("step.eviction.link"), url: "https://selfhelp.courts.ca.gov/eviction-tenant" },
    });
  }
  if (s.housingStatus === "unhoused") steps.push({ when: "today", text: t("step.unhoused"), phone: "211" });
  // Everything above is a safety or legal-deadline step; the top program call goes right after.
  const afterUrgent = steps.length;
  if (needs.includes("utility")) {
    steps.push({ when: "today", text: t("step.utility"), detail: t("step.utility.detail"), phone: LINKS.care.phone });
  }
  if (has("calfresh")) {
    steps.push({
      when: s.monthlyIncome === 0 || needs.includes("food") ? "today" : "week",
      text: t("step.calfresh"),
      detail: t("step.calfresh.detail"),
      link: { label: "GetCalFresh.org", url: LINKS.calfresh.url },
    });
  }
  if (has("medi_cal") || has("medi_cal_kids")) {
    steps.push({ when: "week", text: t("step.medical"), detail: t("step.medical.detail"), phone: LINKS.mediCal.phone });
  }
  if ((has("care") || has("fera")) && !needs.includes("utility")) {
    steps.push({ when: "week", text: t("step.care"), phone: LINKS.care.phone });
  }
  if (has("wic")) steps.push({ when: "week", text: t("step.wic"), phone: LINKS.wic.phone });

  const callStep = (c: CallScript, when: StepWhen): PacketStep => ({
    when,
    text: t(c.phone ? "step.call" : "step.visit", { name: c.name }),
    phone: c.phone,
    link: c.phone ? undefined : { label: t("step.visit.link"), url: c.url },
  });
  // Housing is the most time-sensitive need: when it's at risk, the top
  // program call happens today, right after any crisis or legal-deadline step.
  const housingUrgent = s.housingStatus === "housed_at_risk" || s.housingStatus === "eviction_notice" || s.housingStatus === "unhoused";
  const [first, ...rest] = calls;
  if (first) {
    if (housingUrgent) {
      steps.splice(afterUrgent, 0, callStep(first, "today"));
    } else {
      steps.push(callStep(first, steps.some((x) => x.when === "today") ? "week" : "today"));
    }
  }
  for (const c of rest) steps.push(callStep(c, "week"));
  steps.push({ when: "next", text: t("step.folder") });
  return steps;
}

// ---------------------------------------------------------------------------
// Share text
// ---------------------------------------------------------------------------

const WHEN_KEY: Record<StepWhen, MessageKey> = { now: "when.now", today: "when.today", week: "when.week", next: "when.next" };

function buildShareText(steps: PacketStep[], docs: DocItem[], benefits: BenefitSummary, t: T): string {
  const lines: string[] = [t("share.title"), ""];
  const likely = benefits.estimates.filter((e) => e.status === "likely");
  if (likely.length) {
    lines.push(t("share.benefits"));
    for (const e of likely) lines.push(`• ${e.title}: ${e.valueText}`);
    lines.push("");
  }
  lines.push(t("share.steps"));
  steps.forEach((s, i) => lines.push(`${i + 1}. [${t(WHEN_KEY[s.when])}] ${s.text}${s.phone ? ` (${s.phone})` : ""}`));
  if (docs.length) {
    lines.push("", t("share.docs"));
    for (const d of docs) lines.push(`☐ ${d.label}`);
  }
  lines.push("", t("share.footer"));
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function buildReadyPacket(plan: Plan, benefits: BenefitSummary, t: T, lang: Lang = "en"): ReadyPacket {
  const top = plan.ranked.slice(0, 4);
  const calls = top.map((r) => buildCall(r, plan.situation, t, lang));
  const documents = buildDocuments(plan, benefits, t, top);
  const steps = buildSteps(plan, benefits, calls, t);
  return { steps, documents, calls, shareText: buildShareText(steps, documents, benefits, t) };
}
