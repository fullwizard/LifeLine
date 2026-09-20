/**
 * Plan explainer. Gemini turns already-selected, already-ranked resources
 * into readable prose. It receives ONLY the ranked list and their breakdowns,
 * and any resource id it returns that we did not send is discarded.
 */
import type { ScoredResource, Situation } from "../types";
import { generateJson, geminiEnabled } from "./client";
import { explainByTemplate, templateExplainer } from "./fallback/templateExplainer";
import type { Explanation, PlanExplainer } from "./types";

interface GeminiExplanation {
  summary: string;
  steps: string[];
  resourceNotes: { id: string; note: string }[];
}

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    steps: { type: "array", items: { type: "string" } },
    resourceNotes: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, note: { type: "string" } },
        required: ["id", "note"],
      },
    },
  },
  required: ["summary", "steps", "resourceNotes"],
};

function buildPrompt(situation: Situation, ranked: ScoredResource[]): string {
  const facts = {
    location: situation.location,
    householdSize: situation.householdSize,
    monthlyIncome: situation.monthlyIncome,
    housingStatus: situation.housingStatus,
    hasChildren: situation.hasChildren,
    isVeteran: situation.isVeteran,
    needs: situation.needs,
  };
  const resources = ranked.map((r, i) => ({
    rank: i + 1,
    id: r.resource.id,
    name: r.resource.name,
    organization: r.resource.organization,
    category: r.resource.category,
    description: r.resource.description,
    phone: r.resource.phone,
    required_documents: r.resource.required_documents,
    breakdown: r.breakdown.map((b) => ({ status: b.status, detail: b.detail })),
  }));
  return [
    "You are writing a calm, plain-language action plan for someone facing housing instability.",
    "The resources below were ALREADY selected and ranked by a deterministic system. Do not add, remove, reorder, or rename resources.",
    "Never say the person 'qualifies' or 'is eligible'. Facts marked 'met' match what they told us; facts marked 'unverified' must be confirmed with the organization; say so explicitly.",
    "Write at an 8th-grade reading level. Be warm but concrete.",
    "",
    "Return JSON with:",
    "- summary: 2-3 sentences describing the plan overall.",
    "- steps: 3-6 short, ordered next steps (start with the most urgent).",
    "- resourceNotes: one 1-2 sentence note per resource id explaining why it is on the list and what still needs confirming.",
    "",
    "Person's situation (structured):",
    JSON.stringify(facts, null, 2),
    "",
    "Ranked resources:",
    JSON.stringify(resources, null, 2),
  ].join("\n");
}

export const geminiExplainer: PlanExplainer = {
  async explain(situation, ranked): Promise<Explanation> {
    const g = await generateJson<GeminiExplanation>(buildPrompt(situation, ranked), SCHEMA);
    const allowed = new Set(ranked.map((r) => r.resource.id));
    const fallback = explainByTemplate(situation, ranked);
    const resourceNotes: Record<string, string> = {};
    for (const n of g.resourceNotes ?? []) {
      if (allowed.has(n.id) && typeof n.note === "string" && n.note.trim()) resourceNotes[n.id] = n.note.trim();
    }
    // Fill any resource Gemini skipped from the template so nothing goes blank.
    for (const id of allowed) if (!resourceNotes[id]) resourceNotes[id] = fallback.resourceNotes[id];
    return {
      summary: g.summary?.trim() || fallback.summary,
      steps: Array.isArray(g.steps) && g.steps.length ? g.steps.map(String) : fallback.steps,
      resourceNotes,
      provider: "gemini",
    };
  },
};

/** Default entry point: Gemini if configured, else template fallback. */
export async function explainPlan(situation: Situation, ranked: ScoredResource[]): Promise<Explanation> {
  if (geminiEnabled()) {
    try {
      return await geminiExplainer.explain(situation, ranked);
    } catch (err) {
      console.warn("[LifeLine] Gemini explain failed, using template fallback:", err);
    }
  }
  return templateExplainer.explain(situation, ranked);
}
