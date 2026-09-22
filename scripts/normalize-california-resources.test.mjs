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
    expect(result.candidates[0].category).toBe("older_adult_support");
    expect(result.candidates[0].application_url).toBe("https://example.ca.gov/food");
  });

  it("prioritizes substance-use support when page evidence names it", () => {
    const result = normalizeCrawl({ sources: [{ ...source, pages: [page({
      title: "Substance Use Recovery Services",
      description: "Treatment, recovery, and behavioral health support for people using methamphetamine or opioids.",
      relevance: { relevant: true, topics: ["health_care", "substance_use_disorder"], matchedTerms: ["substance use"] },
      links: [],
    })] }] });
    expect(result.candidates[0].category).toBe("substance_use");
  });

  it("does not classify a digital literacy page as mental health because of shared navigation", () => {
    const result = normalizeCrawl({ sources: [{ ...source, pages: [page({
      title: "Digital Literacy Resources | California Department of Aging",
      headings: ["What Resources Are Available", "Digital Literacy Resources"],
      description: "State of California",
      excerpt: "Mental health services Substance use resources Digital Literacy Resources Digital literacy training helps older adults learn to use devices and the internet.",
      text: "Mental health services Substance use resources Digital Literacy Resources Digital literacy training helps older adults learn to use devices and the internet.",
      relevance: { relevant: true, topics: ["mental_health_condition", "older_adult_support"] },
    })] }] });
    expect(result.candidates[0].category).toBe("older_adult_support");
    expect(result.candidates[0].description).toMatch(/^Digital Literacy Resources/);
  });

  it("categorizes an aging program by its own title and skips the county service directory", () => {
    const result = normalizeCrawl({ sources: [{ ...source, pages: [
      page({ title: "Family Caregiver Services - Consumer | California Department of Aging", headings: ["How Do I?", "Family Caregiver Services"], excerpt: "Mental health services Family Caregiver Services Support for people caring for a family member.", text: "Mental health services Family Caregiver Services Support for people caring for a family member." }),
      page({ url: "https://example.ca.gov/find-services", title: "Find Services in My County - Consumer | California Department of Aging", contentHash: "directory" }),
    ] }] });
    expect(result.candidates.map((candidate) => [candidate.name, candidate.category])).toEqual([
      ["Family Caregiver Services - Consumer", "family_support"],
    ]);
  });

  it("uses the actual service section instead of a repeated county-referral introduction", () => {
    const result = normalizeCrawl({ sources: [{ ...source, pages: [page({
      title: "Family Caregiver Services - Consumer | California Department of Aging",
      headings: ["Family Caregiver Services", "How To Find Services In My Area", "What Services Are Available"],
      description: "State of California",
      text: "How Do I? Family Caregiver Services How To Find Services In My Area Find services in your county. What Services Are Available Family caregiver respite and training help relatives care for older adults.",
    })] }] });
    expect(result.candidates[0].description).toMatch(/^Family caregiver respite/);
    expect(result.candidates[0].category).toBe("family_support");
  });

  it("uses the housing section and article evidence for programs with nonliteral names", () => {
    const result = normalizeCrawl({ sources: [{ ...source, pages: [page({
      url: "https://example.ca.gov/housing-programs/bringing-families-home",
      title: "Bringing Families Home Program",
      description: "Families in the child welfare system can receive housing navigation and rental assistance.",
      text: "Families in the child welfare system can receive housing navigation and rental assistance.",
      contentHash: "families-home",
    })] }] });
    expect(result.candidates[0].category).toBe("rental_assistance");
  });

  it("does not turn an older-adult day program into mental-health treatment from a secondary service mention", () => {
    const result = normalizeCrawl({ sources: [{ ...source, pages: [page({
      title: "Community-Based Adult Services - Medicare Services | California Department of Aging",
      headings: ["Community-Based Adult Services (CBAS)"],
      description: "State of California",
      text: "Community-Based Adult Services (CBAS) is a day health program for older adults with chronic medical needs. It includes health care, social activities, and mental health support.",
      relevance: { relevant: true, topics: ["mental_health_condition", "older_adult_support"] },
      contentHash: "cbas",
    })] }] });
    expect(result.candidates[0].category).toBe("older_adult_support");
  });

  it("deduplicates canonical/content-identical pages and excludes skipped pages", () => {
    const result = normalizeCrawl({ sources: [{ ...source, pages: [page(), page({ url: "https://example.ca.gov/food?utm_source=x", canonicalUrl: "https://example.ca.gov/food" }), page({ relevance: { relevant: false, topics: [] } })] }] });
    expect(result.summary.candidates).toBe(1);
  });

  it("deduplicates localized and renamed copies of the same program", () => {
    const first = page({ title: "CFAP", description: "California food assistance benefits.", excerpt: "California food assistance benefits." });
    const copy = page({
      url: "https://example.ca.gov/food-ko",
      title: "CFAP Outreach",
      description: "California food assistance benefits.",
      excerpt: "California food assistance benefits.",
      contentHash: "different-page-but-same-program",
    });
    const result = normalizeCrawl({ sources: [{ ...source, pages: [first, copy] }] });
    expect(result.summary.candidates).toBe(1);
  });

  it("deduplicates same-program pages when their descriptions are identical", () => {
    const first = page({
      title: "Community Living Services",
      description: "A real program that provides disability services and independent living support across California.",
      excerpt: "A real program that provides disability services and independent living support across California.",
    });
    const copy = page({
      url: "https://example.ca.gov/disability-services-copy",
      title: "DAS Services",
      description: "A real program that provides disability services and independent living support across California.",
      excerpt: "A real program that provides disability services and independent living support across California.",
      contentHash: "different-content-hash",
    });
    const result = normalizeCrawl({ sources: [{ ...source, pages: [first, copy] }] });
    expect(result.summary.candidates).toBe(1);
  });

  it("keeps merged names and descriptions indexed for later duplicate pages", () => {
    const firstText = "This rental assistance program helps eligible households remain housed through direct support and referrals. First version.";
    const laterText = "This rental assistance program helps eligible households remain housed through direct support and referrals. Updated version.";
    const result = normalizeCrawl({ sources: [{ ...source, pages: [
      page({ title: "Housing Stability Program", text: firstText, excerpt: firstText, contentHash: "first" }),
      page({ url: "https://example.ca.gov/housing-stability-v2", title: "Housing Stability Program", text: laterText, excerpt: laterText, contentHash: "second" }),
      page({ url: "https://example.ca.gov/housing-stability-guide", title: "Staying Housed", text: laterText, excerpt: laterText, contentHash: "third" }),
    ] }] });
    expect(result.summary.candidates).toBe(1);
  });

  it("deduplicates a specifically named program across sources while retaining generic local services", () => {
    const otherSource = { ...source, id: "partner", name: "Community Partner", serviceArea: "San Mateo County, CA" };
    const result = normalizeCrawl({ sources: [
      { ...otherSource, pages: [page({ url: "https://partner.org/calfresh", title: "CalFresh", description: "Partner help applying for CalFresh food benefits.", contentHash: "calfresh-partner" }), page({ url: "https://partner.org/food-help", title: "Food Assistance", contentHash: "food-partner" })] },
      { ...source, pages: [page({ title: "CalFresh", description: "Official CalFresh food benefits for eligible California households.", contentHash: "calfresh-official" }), page({ url: "https://example.ca.gov/food-help", title: "Food Assistance", contentHash: "food-local" })] },
    ] });
    expect(result.candidates.filter((candidate) => candidate.name === "CalFresh")).toHaveLength(1);
    expect(result.candidates.find((candidate) => candidate.name === "CalFresh").source_url).toBe("https://example.ca.gov/food");
    expect(result.candidates.filter((candidate) => candidate.name === "Food Assistance")).toHaveLength(2);
  });

  it("does not list program guides, eligibility pages, or event pages as additional programs", () => {
    const result = normalizeCrawl({ sources: [{ ...source, pages: [
      page({ title: "Applying for CalFresh", contentHash: "applying" }),
      page({ url: "https://example.ca.gov/eligibility", title: "LIHEAP Income Eligibility", contentHash: "eligibility" }),
      page({ url: "https://example.ca.gov/Job_Fairs_and_Workshops/event", title: "Youth Employment Workshop", contentHash: "event" }),
      page({ url: "https://example.ca.gov/calfresh", title: "CalFresh", contentHash: "calfresh" }),
    ] }] });
    expect(result.candidates.map((candidate) => candidate.name)).toEqual(["CalFresh"]);
  });

  it("extracts a stated annual income cap instead of treating CalEITC as unlimited", () => {
    const result = normalizeCrawl({ sources: [{ ...source, pages: [page({
      title: "California Earned Income Tax Credit",
      description: "State of California",
      excerpt: "Californians earning under $31,950 a year may qualify for the California Earned Income Tax Credit.",
      text: "Californians earning under $31,950 a year may qualify for the California Earned Income Tax Credit.",
      relevance: { relevant: true, topics: ["public_benefits", "family_support"], matchedTerms: ["earned income"] },
      contentHash: "caleitc",
    })] }] });
    expect(result.candidates[0]).toMatchObject({
      name: "California Earned Income Tax Credit",
      organization: "California Franchise Tax Board",
      category: "benefits",
      description: expect.stringContaining("$31,950"),
      eligibility: { max_annual_income: 31950 },
      eligibility_verified: false,
    });
  });

  it("reads the current FTB wording when an income cap says not more than", () => {
    const result = normalizeCrawl({ sources: [{ ...source, pages: [page({
      url: "https://www.ftb.ca.gov/file/personal/credits/caleitc/eligibility-and-credit-information.html",
      title: "Eligibility and credit information | FTB.ca.gov",
      headings: ["Eligibility and credit information CalEITC", "Check if you qualify for CalEITC"],
      description: "Official tax credit eligibility information.",
      excerpt: "Have earned income of at least $1 and not more than $32,900.",
      text: "Have earned income of at least $1 and not more than $32,900.",
      relevance: { relevant: true, topics: ["public_benefits"], matchedTerms: ["tax credits"] },
      contentHash: "caleitc-current",
    })] }] });
    expect(result.candidates[0].eligibility).toEqual({ max_annual_income: 32900 });
  });

  it("omits navigation pages that are not programs", () => {
    const result = normalizeCrawl({ sources: [{ ...source, pages: [
      page({ title: "How to Apply?", description: "A page about applying for this program." }),
      page({ title: "Other Resources", description: "Links and references." }),
      page({ url: "https://example.ca.gov/cfap", title: "CFAP", description: "A real food assistance program with application details.", contentHash: "real-program" }),
    ] }] });
    expect(result.candidates.map((candidate) => candidate.name)).toEqual(["CFAP"]);
  });
});
