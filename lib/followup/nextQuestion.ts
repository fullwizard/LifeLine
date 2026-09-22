/**
 * Deterministic follow-up selection.
 *
 * Given a partial Situation and the current candidate resources, find the
 * unknown field that can change enough candidates through the hard gates.
 * A question is worthwhile when a plausible answer can affect at least 10% of
 * the current candidate set. Returns
 * null when no missing field meets that threshold.
 *
 * Pure: no I/O, no AI. Imports only the matching engine and types.
 */
import { runGates } from "../matching/gates";
import { scoreResource } from "../matching/score";
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
      if (parts.length === 2 && /count(?:y|ies)$/i.test(parts[0])) {
        const key = entry.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ location: { county: parts[0] } });
        }
      } else if (parts.length === 2) {
        const key = entry.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ location: { city: parts[0] } });
        }
      }
    }
  }
  // Also simulate a county outside the current source coverage.
  out.push({ location: { county: "Outside California County" } });
  return out;
}

const CANDIDATES: Candidate[] = [
  {
    field: "location",
    isMissing: (s) => !s.location || (!s.location.county && !s.location.city && !s.location.zip && (s.location.lat === undefined || s.location.lng === undefined)),
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

/**
 * Some facts improve the usefulness of a plan even when the current data does
 * not contain a hard eligibility rule for them. Keep asking for those facts
 * when the resource pool makes them relevant instead of treating zero gate
 * eliminations as zero value.
 */
function isHighValueField(field: AskableField, resources: Resource[]): boolean {
  switch (field) {
    case "location":
      return true;
    case "housingStatus":
      return resources.some((r) => ["rental_assistance", "shelter", "legal"].includes(r.category) || r.eligibility.housing_status_any_of || r.eligibility.requires_eviction_notice);
    case "monthlyIncome":
      return resources.some((r) => r.eligibility.max_ami_percent !== undefined || r.eligibility.max_fpl_percent !== undefined || ["rental_assistance", "utility", "benefits", "health", "family_support"].includes(r.category));
    case "householdSize":
      return resources.some((r) => r.eligibility.max_ami_percent !== undefined || r.eligibility.max_fpl_percent !== undefined || ["rental_assistance", "benefits", "family_support"].includes(r.category));
    case "hasChildren":
      return resources.some((r) => r.eligibility.requires_children || r.category === "family_support");
    case "isVeteran":
      return resources.some((r) => r.eligibility.requires_veteran || r.category === "veteran_support");
  }
}

export interface QuestionScore {
  field: AskableField;
  expectedEliminations: number;
  maximumEliminations: number;
  /** Equivalent candidate count from meaningful score changes, not just gates. */
  expectedFitImpact: number;
  maximumFitImpact: number;
}

export function importantQuestionThreshold(candidateCount: number): number {
  return candidateCount * 0.1;
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
    let maximum = 0;
    let fitTotal = 0;
    let fitMaximum = 0;
    for (const a of answers) {
      const remaining = survivors(candidates, { ...situation, ...a }, context);
      const eliminated = baseline - remaining;
      total += eliminated;
      maximum = Math.max(maximum, eliminated);

      // Count material ranking changes as a small number of equivalent
      // candidates, so a question can matter even when it does not gate a
      // program out entirely.
      const beforeScores = new Map(candidates.map((resource) => [resource.id, scoreResource(resource, situation, context).score]));
      const afterScores = new Map(
        candidates
          .filter((resource) => runGates(resource, { ...situation, ...a }, context).length === 0)
          .map((resource) => [resource.id, scoreResource(resource, { ...situation, ...a }, context).score]),
      );
      const changedPoints = [...afterScores].reduce((sum, [id, score]) => sum + Math.abs(score - (beforeScores.get(id) ?? score)), 0);
      const fitImpact = changedPoints / 30;
      fitTotal += fitImpact;
      fitMaximum = Math.max(fitMaximum, fitImpact);
    }
    out.push({
      field: c.field,
      expectedEliminations: total / answers.length,
      maximumEliminations: maximum,
      expectedFitImpact: fitTotal / answers.length,
      maximumFitImpact: fitMaximum,
    });
  }
  return out;
}

export function nextQuestion(
  situation: Situation,
  candidates: Resource[],
  context: MatchContext = {},
): Question | null {
  if (candidates.length === 0) return null;
  const scores = scoreQuestions(situation, candidates, context);
  const threshold = importantQuestionThreshold(candidates.length);
  let best: QuestionScore | undefined;
  for (const s of scores) {
    const highValue = isHighValueField(s.field, candidates);
    if (s.maximumEliminations <= 0 && s.maximumFitImpact < 1 && !highValue) continue;
    if (s.maximumEliminations < threshold && s.maximumFitImpact < 1 && !highValue) continue;
    const currentValue = s.expectedEliminations + s.expectedFitImpact;
    const bestValue = best ? best.expectedEliminations + best.expectedFitImpact : -1;
    if (!best || currentValue > bestValue) best = s;
    // Ties resolve to CANDIDATES order (location, housing status, income, ...).
  }
  if (!best) return null;

  const def = CANDIDATES.find((c) => c.field === best!.field)!;
  const q = def.question();
  const rounded = Math.round(best.expectedEliminations * 10) / 10;
  const rationale = rounded > 0
    ? `Answering this would rule out about ${rounded} of ${candidates.length} possible resources so your plan is more accurate.`
    : "This helps compare programs by fit and gives you more useful next steps.";
  return {
    ...q,
    expectedEliminations: rounded,
    rationale,
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
      const coordinates = value.match(/^Current location \((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$/i);
      if (coordinates) {
        const lat = Number(coordinates[1]);
        const lng = Number(coordinates[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { ...situation, location: { lat, lng } };
        }
      }
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
