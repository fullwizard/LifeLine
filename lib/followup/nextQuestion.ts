/**
 * Deterministic follow-up selection.
 *
 * Given a partial Situation and the current candidate resources, find the
 * single unknown field whose answer would, on average across its plausible
 * answers, eliminate the most candidates through the hard gates. Returns
 * null if no question would eliminate anything.
 *
 * Pure: no I/O, no AI. Imports only the matching engine and types.
 */
import { runGates } from "../matching/gates";
import type {
  AskableField,
  HousingStatus,
  MatchContext,
  Question,
  QuestionOption,
  Resource,
  Situation,
} from "../types";
import { HOUSING_STATUSES } from "../types";

const HOUSING_LABELS: Record<HousingStatus, string> = {
  housed_stable: "Housed and current on rent",
  housed_at_risk: "Housed but behind on rent or worried about losing housing",
  eviction_notice: "Received an eviction or pay-or-vacate notice",
  unhoused: "Currently without housing (car, shelter, outside, couch-surfing)",
};

interface Candidate {
  field: AskableField;
  isMissing: (s: Situation) => boolean;
  /** Plausible answers to simulate, derived from the candidate set. */
  answers: (s: Situation, resources: Resource[]) => Partial<Situation>[];
  question: (options?: QuestionOption[]) => Omit<Question, "expectedEliminations" | "rationale">;
  options?: (resources: Resource[]) => QuestionOption[] | undefined;
}

function serviceAreaLocations(resources: Resource[]): Partial<Situation>[] {
  const seen = new Set<string>();
  const out: Partial<Situation>[] = [];
  for (const r of resources) {
    for (const entry of r.service_area) {
      const parts = entry.split(",").map((p) => p.trim());
      if (parts.length === 2 && /county$/i.test(parts[0])) {
        const key = entry.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ location: { county: parts[0], state: parts[1] } });
        }
      } else if (parts.length === 2) {
        const key = entry.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ location: { city: parts[0], state: parts[1] } });
        }
      }
    }
  }
  // Also simulate "somewhere else entirely" — a state none of them serve.
  out.push({ location: { state: "ZZ" } });
  return out;
}

const CANDIDATES: Candidate[] = [
  {
    field: "location",
    isMissing: (s) => !s.location || (!s.location.county && !s.location.city && !s.location.state),
    answers: (_s, resources) => serviceAreaLocations(resources),
    question: () => ({
      field: "location",
      prompt: "Where do you live? A city, county, or ZIP code is enough.",
      inputType: "text",
    }),
  },
  {
    field: "housingStatus",
    isMissing: (s) => s.housingStatus === undefined,
    answers: () => HOUSING_STATUSES.map((housingStatus) => ({ housingStatus })),
    question: () => ({
      field: "housingStatus",
      prompt: "Which best describes your housing right now?",
      inputType: "select",
      options: HOUSING_STATUSES.map((v) => ({ value: v, label: HOUSING_LABELS[v] })),
    }),
  },
  {
    field: "monthlyIncome",
    isMissing: (s) => s.monthlyIncome === undefined,
    // Try a spread of incomes so both "under" and "over" every cap are sampled.
    answers: () => [1_000, 2_500, 4_000, 6_000, 9_000, 14_000].map((monthlyIncome) => ({ monthlyIncome })),
    question: () => ({
      field: "monthlyIncome",
      prompt: "Roughly how much does your whole household earn per month, before taxes?",
      inputType: "number",
    }),
  },
  {
    field: "householdSize",
    isMissing: (s) => s.householdSize === undefined,
    answers: () => [1, 2, 4, 6].map((householdSize) => ({ householdSize })),
    question: () => ({
      field: "householdSize",
      prompt: "How many people live in your household, including you?",
      inputType: "number",
    }),
  },
  {
    field: "hasChildren",
    isMissing: (s) => s.hasChildren === undefined,
    answers: () => [{ hasChildren: true }, { hasChildren: false }],
    question: () => ({
      field: "hasChildren",
      prompt: "Do you have children under 18 living with you?",
      inputType: "boolean",
    }),
  },
  {
    field: "isVeteran",
    isMissing: (s) => s.isVeteran === undefined,
    answers: () => [{ isVeteran: true }, { isVeteran: false }],
    question: () => ({
      field: "isVeteran",
      prompt: "Have you served in the U.S. military?",
      inputType: "boolean",
    }),
  },
];

function survivors(resources: Resource[], situation: Situation, context: MatchContext): number {
  return resources.filter((r) => runGates(r, situation, context).length === 0).length;
}

export interface QuestionScore {
  field: AskableField;
  expectedEliminations: number;
}

/** Score every missing field. Exposed for tests and debugging. */
export function scoreQuestions(
  situation: Situation,
  candidates: Resource[],
  context: MatchContext = {},
): QuestionScore[] {
  const baseline = survivors(candidates, situation, context);
  const out: QuestionScore[] = [];
  for (const c of CANDIDATES) {
    if (!c.isMissing(situation)) continue;
    const answers = c.answers(situation, candidates);
    if (answers.length === 0) continue;
    let total = 0;
    for (const a of answers) {
      const remaining = survivors(candidates, { ...situation, ...a }, context);
      total += baseline - remaining;
    }
    out.push({ field: c.field, expectedEliminations: total / answers.length });
  }
  return out;
}

export function nextQuestion(
  situation: Situation,
  candidates: Resource[],
  context: MatchContext = {},
): Question | null {
  const scores = scoreQuestions(situation, candidates, context);
  let best: QuestionScore | undefined;
  for (const s of scores) {
    if (s.expectedEliminations <= 0) continue;
    if (!best || s.expectedEliminations > best.expectedEliminations) best = s;
    // Ties resolve to CANDIDATES order (location, housing status, income, ...).
  }
  if (!best) return null;

  const def = CANDIDATES.find((c) => c.field === best!.field)!;
  const q = def.question();
  const rounded = Math.round(best.expectedEliminations * 10) / 10;
  return {
    ...q,
    expectedEliminations: rounded,
    rationale: `Answering this would rule out about ${rounded} of ${candidates.length} possible resources so your plan is more accurate.`,
  };
}

/** Apply a raw answer string to a Situation for the given field. */
export function applyAnswer(
  situation: Situation,
  field: AskableField,
  raw: string,
  resolveLocation: (text: string) => Situation["location"] | undefined,
): Situation {
  const value = raw.trim();
  if (value === "") return situation;
  switch (field) {
    case "location": {
      const loc = resolveLocation(value);
      return loc ? { ...situation, location: loc } : situation;
    }
    case "housingStatus":
      return HOUSING_STATUSES.includes(value as HousingStatus)
        ? { ...situation, housingStatus: value as HousingStatus }
        : situation;
    case "monthlyIncome": {
      const n = Number(value.replace(/[^0-9.]/g, ""));
      return Number.isFinite(n) && n >= 0 ? { ...situation, monthlyIncome: n } : situation;
    }
    case "householdSize": {
      const n = Math.round(Number(value));
      return Number.isFinite(n) && n >= 1 ? { ...situation, householdSize: n } : situation;
    }
    case "hasChildren":
      return { ...situation, hasChildren: value === "true" };
    case "isVeteran":
      return { ...situation, isVeteran: value === "true" };
  }
}
