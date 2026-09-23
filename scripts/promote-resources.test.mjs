import { describe, expect, it } from "vitest";
import { applyOverride, backfillEligibility, promote, validateResource } from "./promote-resources.mjs";

const candidate = (overrides = {}) => ({
  id: "rent-help-1",
  name: "Rent Help",
  organization: "Org",
  category: "rental_assistance",
  description: "Pays back rent.",
  service_area: ["Santa Clara County, CA"],
  active: true,
  eligibility: {},
  eligibility_verified: false,
  required_documents: [],
  application_url: "https://example.org/apply",
  source_url: "https://example.org",
  phone: null,
  last_verified: "2026-09-01",
  ...overrides,
});

describe("promote", () => {
  it("promotes valid candidates and skips uncategorized ones", () => {
    const result = promote({ candidates: [candidate(), candidate({ id: "x", category: null })] }, { overrides: {} });
    expect(result.errors).toEqual([]);
    expect(result.resources.map((r) => r.id)).toEqual(["rent-help-1"]);
    expect(result.stats).toMatchObject({ candidates: 2, promoted: 1, skippedUncategorized: 1, verified: 0 });
  });

  it("applies reviewed overrides and marks them verified", () => {
    const reviewed = {
      overrides: {
        "rent-help-1": {
          reviewed_at: "2026-09-22",
          reviewed_by: "tester",
          eligibility: { max_ami_percent: 80, housing_status_any_of: ["housed_at_risk"] },
          phone: "(408) 555-0100",
          active: true,
        },
      },
    };
    const { resources, errors, warnings } = promote({ candidates: [candidate()] }, reviewed);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(resources[0]).toMatchObject({
      eligibility: { max_ami_percent: 80, housing_status_any_of: ["housed_at_risk"] },
      eligibility_verified: true,
      phone: "(408) 555-0100",
      last_verified: "2026-09-22",
    });
  });

  it("fails on malformed records instead of writing them", () => {
    const bad = candidate({ category: "housing", service_area: ["Santa Clara"], application_url: "not a url", eligibility: { max_ami_percent: "80", bogus: true } });
    const { errors } = promote({ candidates: [bad] }, { overrides: {} });
    expect(errors.join("\n")).toMatch(/category "housing"/);
    expect(errors.join("\n")).toMatch(/service_area entry "Santa Clara"/);
    expect(errors.join("\n")).toMatch(/application_url is not a valid/);
    expect(errors.join("\n")).toMatch(/max_ami_percent must be a number/);
    expect(errors.join("\n")).toMatch(/unknown eligibility field "bogus"/);
  });

  it("warns about stale override ids and shared application URLs", () => {
    const { warnings, errors } = promote(
      { candidates: [candidate(), candidate({ id: "rent-help-2", name: "Rent Help Again" })] },
      { overrides: { "gone-id": { reviewed_at: "2026-09-22", reviewed_by: "t" } } },
    );
    expect(errors).toEqual([]);
    expect(warnings.join("\n")).toMatch(/override "gone-id" does not match/);
    expect(warnings.join("\n")).toMatch(/shares application_url/);
  });

  it("rejects overrides with unknown fields or missing review metadata", () => {
    const { errors } = promote({ candidates: [candidate()] }, { overrides: { "rent-help-1": { eligibility: {}, surprise: 1 } } });
    expect(errors.join("\n")).toMatch(/unknown field "surprise"/);
    expect(errors.join("\n")).toMatch(/reviewed_at and reviewed_by are required/);
  });

  it("accepts every service-area format the matcher understands", () => {
    const errors = [];
    for (const area of ["US", "California", "Santa Clara County, CA", "Santa Clara and San Mateo counties, CA", "San Jose, CA"]) {
      validateResource(candidate({ service_area: [area] }), errors);
    }
    expect(errors).toEqual([]);
  });

  it("applyOverride leaves the candidate untouched when there is no override", () => {
    const c = candidate();
    expect(applyOverride(c, undefined)).toEqual(c);
  });
});

describe("backfillEligibility", () => {
  it("extracts rules from stored evidence when the crawl left eligibility empty", () => {
    const c = candidate({ evidence: { excerpt: "Emergency rent for low-income tenants with past due rent to avoid eviction." } });
    const out = backfillEligibility(c);
    expect(out.eligibility.housing_status_any_of).toEqual(["housed_at_risk", "eviction_notice"]);
    expect(out.eligibility.notes).toContain("Income limits apply");
    expect(out.eligibility_verified).toBe(false);
  });

  it("never overwrites eligibility that is already present", () => {
    const c = candidate({ eligibility: { max_ami_percent: 50 }, evidence: { excerpt: "past due rent" } });
    expect(backfillEligibility(c).eligibility).toEqual({ max_ami_percent: 50 });
  });
});
