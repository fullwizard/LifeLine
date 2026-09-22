import { describe, expect, it } from "vitest";
import type { MatchContext, Resource, Situation } from "../types";
import { matchResources } from "./index";
import { runGates } from "./gates";
import { scoreResource } from "./score";
import { rank } from "./rank";
import { evaluateIncome } from "./income";

// ---------------------------------------------------------------------------
// Fixtures — hand-built, minimal, and independent of lib/data.
// ---------------------------------------------------------------------------

function makeResource(overrides: Partial<Resource> & { id: string }): Resource {
  return {
    name: overrides.id,
    organization: "Test Org",
    category: "rental_assistance",
    description: "Fixture resource",
    service_area: ["King County, WA"],
    active: true,
    eligibility: {},
    required_documents: [],
    application_url: "https://example.org/apply",
    source_url: "https://example.org",
    lat: 47.6062,
    lng: -122.3321,
    ...overrides,
  };
}

const KING_COUNTY_AMI: MatchContext = { areaMedianIncomeAnnual: 160_000 };

const seattleSituation: Situation = {
  location: { city: "Seattle", county: "King County", lat: 47.6062, lng: -122.3321 },
  housingStatus: "eviction_notice",
  needs: ["rental_assistance"],
};

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

describe("gates: geographic exclusion", () => {
  it("excludes a resource serving a different county in the same state", () => {
    const tacoma = makeResource({ id: "pierce-rent", service_area: ["Pierce County, WA"] });
    const failures = runGates(tacoma, seattleSituation);
    expect(failures.map((f) => f.gate)).toEqual(["service_area"]);
  });

  it("excludes a resource serving a different state", () => {
    const portland = makeResource({ id: "or-rent", service_area: ["Multnomah County, OR"] });
    expect(runGates(portland, seattleSituation).map((f) => f.gate)).toEqual(["service_area"]);
  });

  it("keeps county, state, and national resources that cover the user", () => {
    expect(runGates(makeResource({ id: "a", service_area: ["King County, WA"] }), seattleSituation)).toEqual([]);
    expect(runGates(makeResource({ id: "b", service_area: ["WA"] }), seattleSituation)).toEqual([]);
    expect(runGates(makeResource({ id: "c", service_area: ["US"] }), seattleSituation)).toEqual([]);
  });

  it("keeps a multi-area resource if any area matches", () => {
    const multi = makeResource({ id: "multi", service_area: ["Pierce County, WA", "King County, WA"] });
    expect(runGates(multi, seattleSituation)).toEqual([]);
  });

  it("does NOT exclude on location when the user's location is unknown", () => {
    const tacoma = makeResource({ id: "pierce-rent", service_area: ["Pierce County, WA"] });
    expect(runGates(tacoma, { needs: ["rental_assistance"] })).toEqual([]);
  });

  it("keeps statewide resources unverified when only a county is collected", () => {
    const statewide = makeResource({ id: "statewide", service_area: ["WA"] });
    expect(runGates(statewide, { location: { county: "King County" } })).toEqual([]);
  });
});

describe("gates: inactive exclusion", () => {
  it("excludes inactive resources even when everything else matches", () => {
    const inactive = makeResource({ id: "inactive", active: false });
    expect(runGates(inactive, seattleSituation).map((f) => f.gate)).toEqual(["active"]);
  });

  it("reports multiple gate failures together", () => {
    const bad = makeResource({ id: "bad", active: false, service_area: ["Pierce County, WA"] });
    expect(runGates(bad, seattleSituation).map((f) => f.gate).sort()).toEqual(["active", "service_area"]);
  });
});

describe("gates: structural ineligibility", () => {
  it("excludes veteran-only resources when the user says they are not a veteran", () => {
    const vet = makeResource({ id: "vet", eligibility: { requires_veteran: true } });
    expect(runGates(vet, { ...seattleSituation, isVeteran: false }).map((f) => f.gate)).toEqual(["veteran"]);
  });

  it("excludes on income only when the known income clearly exceeds the limit", () => {
    const capped = makeResource({ id: "capped", eligibility: { max_ami_percent: 50 } });
    // 50% of $160k for 2 people = $64k/yr. $8k/month = $96k/yr → over.
    const over: Situation = { ...seattleSituation, monthlyIncome: 8_000, householdSize: 2 };
    expect(runGates(capped, over, KING_COUNTY_AMI).map((f) => f.gate)).toEqual(["income_limit"]);
    // $3k/month = $36k/yr → under.
    const under: Situation = { ...seattleSituation, monthlyIncome: 3_000, householdSize: 2 };
    expect(runGates(capped, under, KING_COUNTY_AMI)).toEqual([]);
  });

  it("enforces a stated annual income cap", () => {
    const eitc = makeResource({ id: "caleitc", category: "benefits", eligibility: { max_annual_income: 31_950 } });
    const over: Situation = { ...seattleSituation, monthlyIncome: 4_000 };
    expect(runGates(eitc, over).map((f) => f.gate)).toEqual(["income_limit"]);
    expect(evaluateIncome(eitc.eligibility, over, undefined).status).toBe("unmet");
  });

  it("excludes shelter for someone who is stably housed", () => {
    const shelter = makeResource({
      id: "shelter",
      category: "shelter",
      eligibility: { housing_status_any_of: ["unhoused", "eviction_notice"] },
    });
    expect(runGates(shelter, { ...seattleSituation, housingStatus: "housed_stable" }).map((f) => f.gate)).toEqual([
      "housing_status",
    ]);
    expect(runGates(shelter, seattleSituation)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Scoring: unverified is never treated as met
// ---------------------------------------------------------------------------

describe("scoring: unverified eligibility is flagged, not assumed", () => {
  it("flags veteran requirement as unverified when veteran status is unknown", () => {
    const vet = makeResource({ id: "vet", eligibility: { requires_veteran: true } });
    const scored = scoreResource(vet, seattleSituation); // isVeteran undefined
    const factor = scored.breakdown.find((b) => b.factor === "veteran");
    expect(factor?.status).toBe("unverified");
    expect(factor?.points).toBe(0);
    expect(scored.needsVerification).toBe(true);
  });

  it("flags income limit as unverified when income is unknown", () => {
    const capped = makeResource({ id: "capped", eligibility: { max_ami_percent: 80 } });
    const scored = scoreResource(capped, seattleSituation, KING_COUNTY_AMI);
    const factor = scored.breakdown.find((b) => b.factor === "income_limit");
    expect(factor?.status).toBe("unverified");
    expect(factor?.points).toBe(0);
  });

  it("does not claim an unreviewed source has no income limit", () => {
    const crawled = makeResource({ id: "crawled", eligibility: {}, eligibility_verified: false });
    const factor = scoreResource(crawled, seattleSituation).breakdown.find((b) => b.factor === "income_limit");
    expect(factor?.status).toBe("unverified");
    expect(factor?.detail).toContain("not been verified");
  });

  it("flags income as unverified when the answer depends on unknown household size", () => {
    // 80% AMI: 1-person limit = 160k*0.7*0.8 = $89.6k; 8-person = 160k*1.32*0.8 = $169k.
    const verdict = evaluateIncome({ max_ami_percent: 80 }, { monthlyIncome: 10_000 }, 160_000); // $120k/yr
    expect(verdict.status).toBe("unverified");
    // Clearly under the 1-person limit → met regardless of size.
    expect(evaluateIncome({ max_ami_percent: 80 }, { monthlyIncome: 3_000 }, 160_000).status).toBe("met");
    // Clearly over the 8-person limit → unmet regardless of size.
    expect(evaluateIncome({ max_ami_percent: 80 }, { monthlyIncome: 20_000 }, 160_000).status).toBe("unmet");
  });

  it("marks free-text eligibility notes as unverified", () => {
    const notes = makeResource({ id: "notes", eligibility: { notes: "Must have lived in the unit 90 days" } });
    const scored = scoreResource(notes, seattleSituation);
    expect(scored.breakdown.find((b) => b.factor === "other_conditions")?.status).toBe("unverified");
  });

  it("marks service area as unverified (not met) when county is unknown", () => {
    const king = makeResource({ id: "king" });
    const scored = scoreResource(king, { location: { county: "Pierce County" } });
    expect(scored.breakdown.find((b) => b.factor === "service_area")?.status).toBe("unverified");
  });

  it("confirmed facts score higher than the same resource with unknown facts", () => {
    const vet = makeResource({ id: "vet", response_time_days: 3, eligibility: { requires_veteran: true, max_ami_percent: 80 } });
    const known = scoreResource(vet, { ...seattleSituation, isVeteran: true, monthlyIncome: 2_500, householdSize: 1 }, KING_COUNTY_AMI);
    const unknown = scoreResource(vet, seattleSituation, KING_COUNTY_AMI);
    expect(known.score).toBeGreaterThan(unknown.score);
    expect(known.needsVerification).toBe(false);
    expect(unknown.needsVerification).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

describe("ranking", () => {
  const fastLocalRent = makeResource({
    id: "fast-local-rent",
    name: "Fast Local Rent Help",
    category: "rental_assistance",
    response_time_days: 3,
  });
  const slowLocalRent = makeResource({
    id: "slow-local-rent",
    name: "Slow Local Rent Help",
    category: "rental_assistance",
    response_time_days: 30,
  });
  const cappedRent = makeResource({
    id: "capped-rent",
    name: "Income-Limited Rent Help",
    category: "rental_assistance",
    response_time_days: 3,
    eligibility: { max_ami_percent: 50 },
  });
  const foodBank = makeResource({
    id: "food",
    name: "Food Bank",
    category: "food",
    response_time_days: 1,
  });
  const inactiveRent = makeResource({ id: "inactive-rent", name: "Closed Program", active: false });
  const tacomaRent = makeResource({ id: "tacoma-rent", name: "Tacoma Rent Help", service_area: ["Pierce County, WA"] });

  const pool = [foodBank, tacomaRent, slowLocalRent, inactiveRent, cappedRent, fastLocalRent];

  it("orders by need match, urgency fit, and certainty; excludes gated resources", () => {
    const result = matchResources(pool, seattleSituation, KING_COUNTY_AMI);
    expect(result.excluded.map((e) => e.resource.id).sort()).toEqual(["inactive-rent", "tacoma-rent"]);
    expect(result.ranked.map((s) => s.resource.id)).toEqual([
      "fast-local-rent", // need + urgency + no income limit
      "capped-rent", // need + urgency, income unverified (0 pts) → below fast-local
      "slow-local-rent", // need, but too slow
    ]);
  });

  it("does not show unrelated categories when a need is explicit", () => {
    const result = matchResources(
      [
        makeResource({ id: "energy", category: "utility" }),
        makeResource({ id: "food", category: "food" }),
      ],
      { ...seattleSituation, needs: ["utility"] },
    );
    expect(result.ranked.map((r) => r.resource.id)).toEqual(["energy"]);
  });

  it("promotes the income-limited resource once income is confirmed", () => {
    const result = matchResources(pool, { ...seattleSituation, monthlyIncome: 2_000, householdSize: 1 }, KING_COUNTY_AMI);
    // Now capped-rent has income "met" (+20) vs fast-local "no limit" (+10).
    expect(result.ranked.map((s) => s.resource.id).slice(0, 2)).toEqual(["capped-rent", "fast-local-rent"]);
  });

  it("breaks score ties in favour of fewer unverified factors, then name", () => {
    const a = scoreResource(makeResource({ id: "a", name: "Alpha" }), seattleSituation);
    const b = scoreResource(makeResource({ id: "b", name: "Beta" }), seattleSituation);
    expect(rank([b, a]).map((s) => s.resource.id)).toEqual(["a", "b"]);

    const withNotes = scoreResource(
      makeResource({ id: "n", name: "Aardvark", eligibility: { notes: "call first" } }),
      seattleSituation,
    );
    expect(withNotes.score).toBe(a.score);
    expect(rank([withNotes, a]).map((s) => s.resource.id)).toEqual(["a", "n"]);
  });

  it("is a pure function: does not mutate its inputs", () => {
    const snapshot = JSON.stringify(pool);
    matchResources(pool, seattleSituation, KING_COUNTY_AMI);
    expect(JSON.stringify(pool)).toBe(snapshot);
  });
});

describe("scoring: breakdown is structured", () => {
  it("every breakdown item has a factor, a status, points, and a detail string", () => {
    const scored = scoreResource(makeResource({ id: "x", required_documents: ["Photo ID"] }), seattleSituation);
    for (const item of scored.breakdown) {
      expect(["met", "unmet", "unverified"]).toContain(item.status);
      expect(typeof item.points).toBe("number");
      expect(item.detail.length).toBeGreaterThan(0);
    }
    expect(scored.score).toBe(scored.breakdown.reduce((s, i) => s + i.points, 0));
  });

  it("reports missing documents as unmet, not disqualifying", () => {
    const r = makeResource({ id: "docs", required_documents: ["Photo ID", "Lease"] });
    const scored = scoreResource(r, { ...seattleSituation, documentsAvailable: ["photo id"] });
    const docs = scored.breakdown.find((b) => b.factor === "documents");
    expect(docs?.status).toBe("unmet");
    expect(docs?.detail).toContain("Lease");
  });
});
