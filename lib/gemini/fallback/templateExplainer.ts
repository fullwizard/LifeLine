/**
 * Template-based plan explainer. Deterministic, no network. Produces prose
 * strictly from the ranked resources and their breakdowns.
 */
import { humanCategory } from "../../matching/score";
import type { ScoredResource, Situation } from "../../types";
import type { Explanation, PlanExplainer } from "../types";

function statusPhrase(s: Situation): string {
  switch (s.housingStatus) {
    case "eviction_notice":
      return "you have received an eviction notice";
    case "unhoused":
      return "you are currently without housing";
    case "housed_at_risk":
      return "you are at risk of losing your housing";
    case "housed_stable":
      return "you are housed but need support";
    default:
      return "you are dealing with housing instability";
  }
}

export function explainByTemplate(situation: Situation, ranked: ScoredResource[]): Explanation {
  if (ranked.length === 0) {
    return {
      summary: "We could not find any resources that match what you told us. Try adding your city or county, or call 211 for a referral.",
      steps: ["Call 211 (free, 24/7) and describe your situation.", "Add more detail above and try again."],
      resourceNotes: {},
      provider: "fallback",
    };
  }

  const top = ranked[0];
  const confirmedCount = ranked.filter((r) => !r.needsVerification).length;
  const summary =
    `Based on what you shared — ${statusPhrase(situation)} — we found ${ranked.length} resource${ranked.length === 1 ? "" : "s"} ` +
    `that may be able to help, starting with ${top.resource.name}. ` +
    (confirmedCount === ranked.length
      ? "Everything we could check matched what you told us, but each organization makes the final decision."
      : `${ranked.length - confirmedCount} of them still need eligibility confirmed with the organization.`);

  const steps: string[] = [];
  const urgent = situation.housingStatus === "eviction_notice" || situation.housingStatus === "unhoused";
  if (urgent) steps.push("Act today: your situation is time-sensitive, so start with the fastest options first.");
  ranked.slice(0, 3).forEach((r, i) => {
    const docs = r.resource.required_documents;
    steps.push(
      `${i + 1}. Contact ${r.resource.name}${r.resource.phone ? ` (${r.resource.phone})` : ""}` +
        (docs.length ? ` — bring ${docs.slice(0, 3).join(", ")}${docs.length > 3 ? ", and more" : ""}.` : "."),
    );
  });
  steps.push("Tell each organization exactly what you told us; they will confirm whether you qualify.");

  const resourceNotes: Record<string, string> = {};
  for (const r of ranked) {
    const met = r.breakdown.filter((b) => b.status === "met" && b.points > 0).map((b) => b.detail);
    const unverified = r.breakdown.filter((b) => b.status === "unverified").map((b) => b.detail);
    const parts = [`${r.resource.organization} provides ${humanCategory(r.resource.category)}.`];
    if (met.length) parts.push(`What matches: ${met.slice(0, 2).join(" ")}`);
    if (unverified.length) parts.push(`Still to confirm: ${unverified.slice(0, 2).join(" ")}`);
    resourceNotes[r.resource.id] = parts.join(" ");
  }

  return { summary, steps, resourceNotes, provider: "fallback" };
}

export const templateExplainer: PlanExplainer = {
  async explain(situation, ranked) {
    return explainByTemplate(situation, ranked);
  },
};
