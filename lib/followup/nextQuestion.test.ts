import { describe, expect, it } from "vitest";
import type { Resource, Situation } from "../types";
import { applyAnswer, importantQuestionThreshold, nextQuestion, scoreQuestions } from "./nextQuestion";

function makeResource(overrides: Partial<Resource> & { id: string }): Resource {
  return {
    name: overrides.id,
    organization: "Test Org",
    category: "rental_assistance",
    description: "Fixture",
    service_area: ["King County, WA"],
    active: true,
    eligibility: {},
    required_documents: [],
    application_url: "https://example.org",
    source_url: "https://example.org",
    lat: 47.6,
    lng: -122.3,
    ...overrides,
  };
}

const pool: Resource[] = [
  makeResource({ id: "king-1" }),
  makeResource({ id: "king-2" }),
  makeResource({ id: "pierce-1", service_area: ["Pierce County, WA"] }),
  makeResource({ id: "national", service_area: ["US"] }),
  makeResource({ id: "vets", eligibility: { requires_veteran: true } }),
  makeResource({ id: "shelter", category: "shelter", eligibility: { housing_status_any_of: ["unhoused"] } }),
];

describe("nextQuestion", () => {
  it("asks about location first when nothing is known", () => {
    const q = nextQuestion({}, pool);
    expect(q?.field).toBe("location");
    expect(q?.expectedEliminations).toBeGreaterThan(0);
  });

  it("picks the field that eliminates the most candidates", () => {
    const known: Situation = { location: { county: "King County" } };
    const scores = scoreQuestions(known, pool);
    // housingStatus: shelter is excluded for 3 of 4 statuses → 0.75 avg.
    // isVeteran: vets excluded for 1 of 2 answers → 0.5 avg.
    const byField = Object.fromEntries(scores.map((s) => [s.field, s.expectedEliminations]));
    expect(byField.housingStatus).toBeCloseTo(0.75);
    expect(byField.isVeteran).toBeCloseTo(0.5);
    expect(byField.monthlyIncome).toBe(0); // no income caps in this pool
    expect(nextQuestion(known, pool)?.field).toBe("housingStatus");
  });

  it("never asks about a field that is already known", () => {
    const q = nextQuestion({ location: { county: "King County" }, housingStatus: "eviction_notice" }, pool);
    expect(q?.field).toBe("isVeteran");
  });

  it("returns null when no remaining question would eliminate anything", () => {
    const situation: Situation = {
      location: { county: "King County" },
      housingStatus: "eviction_notice",
      isVeteran: true,
    };
    expect(nextQuestion(situation, pool)).toBeNull();
  });

  it("returns null for an empty candidate set", () => {
    expect(nextQuestion({}, [])).toBeNull();
  });

  it("asks about income only when candidates have income limits", () => {
    const capped = [makeResource({ id: "cap", eligibility: { max_fpl_percent: 150 } }), makeResource({ id: "open" })];
    const situation: Situation = { location: { county: "King County" }, housingStatus: "housed_at_risk", householdSize: 2 };
    expect(nextQuestion(situation, capped)?.field).toBe("monthlyIncome");
  });

  it("asks only when a plausible answer can affect at least 10% of candidates", () => {
    const childrenOnly = makeResource({ id: "children-only", eligibility: { requires_children: true } });
    const tenPrograms = [childrenOnly, ...Array.from({ length: 9 }, (_, i) => makeResource({ id: `open-${i}` }))];
    const nineteenPrograms = [childrenOnly, ...Array.from({ length: 18 }, (_, i) => makeResource({ id: `near-open-${i}` }))];
    const twentyPrograms = [childrenOnly, ...Array.from({ length: 19 }, (_, i) => makeResource({ id: `more-open-${i}` }))];
    const known: Situation = {
      location: { county: "King County" },
      housingStatus: "housed_at_risk",
      householdSize: 2,
    };

    expect(importantQuestionThreshold(10)).toBe(1);
    expect(importantQuestionThreshold(19)).toBeCloseTo(1.9);
    expect(importantQuestionThreshold(20)).toBe(2);
    expect(nextQuestion(known, tenPrograms)?.field).toBe("hasChildren");
    expect(nextQuestion(known, nineteenPrograms)).toBeNull();
    expect(nextQuestion(known, twentyPrograms)).toBeNull();
  });
});

describe("applyAnswer", () => {
  const resolve = (t: string) => (t.toLowerCase().includes("seattle") ? { city: "Seattle", county: "King County" } : undefined);

  it("parses numbers, booleans, selects, and locations", () => {
    expect(applyAnswer({}, "monthlyIncome", "$2,400", resolve).monthlyIncome).toBe(2400);
    expect(applyAnswer({}, "householdSize", "3", resolve).householdSize).toBe(3);
    expect(applyAnswer({}, "hasChildren", "true", resolve).hasChildren).toBe(true);
    expect(applyAnswer({}, "isVeteran", "false", resolve).isVeteran).toBe(false);
    expect(applyAnswer({}, "housingStatus", "unhoused", resolve).housingStatus).toBe("unhoused");
    expect(applyAnswer({}, "location", "Seattle", resolve).location?.county).toBe("King County");
  });

  it("leaves the situation unchanged for blank or unparseable answers", () => {
    const s: Situation = { householdSize: 2 };
    expect(applyAnswer(s, "monthlyIncome", "", resolve)).toEqual(s);
    expect(applyAnswer(s, "housingStatus", "bogus", resolve)).toEqual(s);
    expect(applyAnswer(s, "location", "Atlantis", resolve)).toEqual(s);
  });
});
