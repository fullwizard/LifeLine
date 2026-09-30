import { describe, expect, it } from "vitest";
import { estimateBenefits } from "../benefits/estimate";
import { translator } from "../i18n";
import type { Plan, Resource, ScoredResource, Situation } from "../types";
import { buildReadyPacket } from "./readyPacket";

const t = translator("en");
const ON = new Date("2026-10-15T12:00:00Z");

function resource(overrides: Partial<Resource> = {}): Resource {
  return {
    id: "rent-help",
    name: "Rent Help Program",
    organization: "Helping Org",
    category: "rental_assistance",
    description: "Pays back rent.",
    service_area: ["Santa Clara County, CA"],
    active: true,
    eligibility: {},
    eligibility_verified: true,
    required_documents: ["Photo ID", "Lease or rental agreement", "Eviction notice"],
    application_url: "https://example.org/apply",
    source_url: "https://example.org",
    phone: "(408) 555-0100",
    ...overrides,
  };
}

function scored(r: Resource, unverified: ScoredResource["breakdown"] = []): ScoredResource {
  return {
    resource: r,
    score: 50,
    breakdown: [{ factor: "need_match", status: "met", points: 20, detail: "Matches." }, ...unverified],
    needsVerification: unverified.length > 0,
  };
}

function plan(situation: Situation, ranked: ScoredResource[]): Plan {
  return {
    situation,
    ranked,
    related: [],
    excludedCount: 0,
    summary: "",
    steps: [],
    resourceNotes: {},
    generatedBy: "fallback",
    parsedBy: "fallback",
    disclaimer: "",
    lang: "en",
  };
}

const evicted: Situation = {
  location: { city: "San Jose", county: "Santa Clara County" },
  householdSize: 3,
  monthlyIncome: 2400,
  incomeSource: "earned",
  housingStatus: "eviction_notice",
  hasChildren: true,
  needs: ["rental_assistance", "legal", "utility"],
};

describe("ready packet", () => {
  const ranked = [
    scored(resource(), [{ factor: "income_limit", status: "unverified", points: 0, detail: "Income limits apply." }]),
    scored(resource({ id: "legal", name: "Tenant Lawyers", category: "legal", phone: undefined, required_documents: [] })),
  ];
  const p = plan(evicted, ranked);
  const packet = buildReadyPacket(p, estimateBenefits(evicted, t, "en", ON), t, "en");

  it("puts the eviction deadline first and orders steps by urgency", () => {
    expect(packet.steps[0]).toMatchObject({ when: "today" });
    expect(packet.steps[0].detail).toMatch(/10 court days/);
    const whens = packet.steps.map((s) => s.when);
    expect(whens.indexOf("week")).toBeGreaterThan(whens.lastIndexOf("today") - 1);
    expect(packet.steps.at(-1)?.when).toBe("next");
  });

  it("merges documents across programs without duplicates", () => {
    const keys = packet.documents.map((d) => d.key);
    expect(keys[0]).toBe("notice");
    expect(new Set(keys).size).toBe(keys.length);
    const id = packet.documents.find((d) => d.key === "id")!;
    expect(id.forWhat).toEqual(expect.arrayContaining(["Rent Help Program"]));
    expect(id.forWhat.length).toBeGreaterThan(1);
  });

  it("writes a call script from the person's facts and the unverified checks", () => {
    const call = packet.calls[0];
    expect(call.opener).toContain("Rent Help Program");
    expect(call.opener).toContain("San Jose");
    expect(call.opener).toContain("3 people");
    expect(call.questions[0]).toMatch(/income limit for a household of 3/);
  });

  it("points to the website when there is no phone number", () => {
    expect(packet.steps.some((s) => s.text.includes("Tenant Lawyers") && s.link?.url === "https://example.org/apply")).toBe(true);
  });

  it("produces plain share text", () => {
    expect(packet.shareText).toContain("My LifeLine plan");
    expect(packet.shareText).toContain("CalFresh");
    expect(packet.shareText).toMatch(/☐ Photo ID/);
  });

  it("tells people without an address that they can still apply", () => {
    const unhoused: Situation = { householdSize: 1, monthlyIncome: 0, housingStatus: "unhoused", needs: ["shelter", "food"] };
    const pk = buildReadyPacket(plan(unhoused, []), estimateBenefits(unhoused, t, "en", ON), t, "en");
    expect(pk.steps[0].phone).toBe("211");
    expect(pk.documents.find((d) => d.key === "address")?.tip).toMatch(/still apply/);
    expect(pk.documents.some((d) => d.key === "lease")).toBe(false);
  });
});
