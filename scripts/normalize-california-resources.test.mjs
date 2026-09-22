import { describe, expect, it } from "vitest";
import { normalizeCrawl } from "./normalize-california-resources.mjs";

const page = (overrides = {}) => ({
  url: "https://example.ca.gov/food",
  title: "Food assistance",
  description: "Apply for food help.",
  excerpt: "Apply for food help and eligibility information.",
  text: "Apply for food help and eligibility information.",
  contentHash: "same",
  relevance: { relevant: true, topics: ["food"], matchedTerms: ["food assistance"] },
  links: [{ url: "https://example.ca.gov/apply", text: "Apply now", context: "Apply now for help." }],
  contacts: { phones: [{ value: "(555) 555-1212" }], emails: [{ value: "help@example.ca.gov" }] },
  ...overrides,
});
const source = { id: "county", name: "County Human Services", serviceArea: "Santa Clara County, CA", sourceType: "official", evidenceUrls: [] };

describe("normalizeCrawl", () => {
  it("maps evidence into a conservative candidate without inventing eligibility", () => {
    const result = normalizeCrawl({ schemaVersion: 2, generatedAt: "2026-01-01T00:00:00.000Z", complete: true, summary: {}, sources: [{ ...source, pages: [page()] }] });
    expect(result.summary.candidates).toBe(1);
    expect(result.candidates[0]).toMatchObject({ category: "food", service_area: ["Santa Clara County, CA"], application_url: "https://example.ca.gov/apply", active: true, reviewStatus: "needs_review" });
    expect(result.candidates[0].eligibility).toEqual({});
    expect(result.candidates[0].evidence.excerpt).toContain("food help");
  });

  it("maps condition-related pages to the condition support category", () => {
    const result = normalizeCrawl({ sources: [{ ...source, pages: [page({ title: "Diabetes support", relevance: { relevant: true, topics: ["diabetes"], matchedTerms: ["diabetes"] }, links: [] })] }] });
    expect(result.candidates[0].category).toBe("condition_support");
    expect(result.summary.uncategorized).toBe(0);
  });

  it("does not turn a health page into rental assistance or borrow an unrelated application link", () => {
    const result = normalizeCrawl({ sources: [{ ...source, pages: [page({
      title: "Adult Day Services Programs",
      description: "Programs for older adults and adults with disabilities.",
      excerpt: "Adult day services and caregiver support.",
      relevance: { relevant: true, topics: ["rental_assistance", "health_care", "disability"] },
      links: [{ url: "https://dhcs.ca.gov/apply", text: "Apply for Medi-Cal", context: "Apply for Medi-Cal" }],
    })] }] });
    expect(result.candidates[0].category).toBe("health");
    expect(result.candidates[0].application_url).toBe("https://example.ca.gov/food");
  });

  it("deduplicates canonical/content-identical pages and excludes skipped pages", () => {
    const result = normalizeCrawl({ sources: [{ ...source, pages: [page(), page({ url: "https://example.ca.gov/food?utm_source=x", canonicalUrl: "https://example.ca.gov/food" }), page({ relevance: { relevant: false, topics: [] } })] }] });
    expect(result.summary.candidates).toBe(1);
  });
});
