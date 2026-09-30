/**
 * Template-based plan explainer. Deterministic, no network. Produces prose
 * strictly from the ranked resources and their breakdowns.
 */
import { humanCategory } from "../../matching/score";
import { translator, type Lang, type MessageKey, type T } from "../../i18n";
import type { ScoredResource, Situation } from "../../types";
import type { Explanation, PlanExplainer } from "../types";

function describeNeeds(s: Situation, t: T): string {
  const needs = (s.needs ?? []).map((n) => t(`need.${n}` as MessageKey).toLowerCase());
  if (needs.length === 0) return t("explain.needs.none");
  const list = needs.length === 1 ? needs[0] : `${needs.slice(0, -1).join(", ")}${t("explain.and")}${needs[needs.length - 1]}`;
  return t("explain.needs.some", { list });
}

function statusPhrase(s: Situation, t: T): string {
  return s.housingStatus ? t(`explain.status.${s.housingStatus}` as MessageKey) : describeNeeds(s, t);
}

export function explainByTemplate(situation: Situation, ranked: ScoredResource[], lang: Lang = "en"): Explanation {
  const t = translator(lang);
  if (ranked.length === 0) {
    return {
      summary: t("explain.none.summary"),
      steps: [t("explain.none.step1"), t("explain.none.step2")],
      resourceNotes: {},
      provider: "fallback",
    };
  }

  const top = ranked[0];
  const confirmedCount = ranked.filter((r) => !r.needsVerification).length;
  const summary = [
    t(ranked.length === 1 ? "explain.summary.one" : "explain.summary", {
      status: statusPhrase(situation, t),
      n: ranked.length,
      top: top.resource.name,
    }),
    confirmedCount === ranked.length ? t("explain.allConfirmed") : t("explain.someUnverified", { n: ranked.length - confirmedCount }),
  ].join(" ");

  const steps: string[] = [];
  const urgent = situation.housingStatus === "eviction_notice" || situation.housingStatus === "unhoused";
  if (urgent) steps.push(t("explain.urgent"));
  ranked.slice(0, 3).forEach((r, i) => {
    const docs = r.resource.required_documents;
    steps.push(
      `${i + 1}. ` +
        t("explain.contact", { name: r.resource.name, phone: r.resource.phone ? ` (${r.resource.phone})` : "" }) +
        (docs.length ? t("explain.bring", { list: docs.slice(0, 3).join(", ") + (docs.length > 3 ? t("explain.andMore") : "") }) : "") +
        ".",
    );
  });
  steps.push(t("explain.tell"));

  // Per-program notes quote the matching engine's English details, so they are
  // only written in English; other languages show the program description.
  const resourceNotes: Record<string, string> = {};
  if (lang === "en") {
    for (const r of ranked) {
      const met = r.breakdown.filter((b) => b.status === "met" && b.points > 0).map((b) => b.detail);
      const unverified = r.breakdown.filter((b) => b.status === "unverified").map((b) => b.detail);
      const parts = [`${r.resource.organization} provides ${humanCategory(r.resource.category)}.`];
      if (met.length) parts.push(`What matches: ${met.slice(0, 2).join(" ")}`);
      if (unverified.length) parts.push(`Still to confirm: ${unverified.slice(0, 2).join(" ")}`);
      resourceNotes[r.resource.id] = parts.join(" ");
    }
  }

  return { summary, steps, resourceNotes, provider: "fallback" };
}

export const templateExplainer: PlanExplainer = {
  async explain(situation, ranked, lang) {
    return explainByTemplate(situation, ranked, lang);
  },
};
