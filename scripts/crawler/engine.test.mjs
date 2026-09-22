import { describe, expect, it } from "vitest";
import { crawlSources } from "./engine.mjs";
import { normalizeUrl, inSourceScope, crawlTrap } from "./urls.mjs";
import { parseOptions } from "../crawl-california-resources.mjs";

function source(id = "first", overrides = {}) {
  return { id, name: id, startUrl: `https://${id}.ca.gov/`, allowedOrigins: [`https://${id}.ca.gov`],
    allowedPathPrefixes: ["/"], serviceArea: "California", priority: 25, crawlOrder: 0, maxPages: 10, ...overrides };
}
const page = (label, links = "") => `<html><title>${label}</title><main><h1>${label}</h1><p>Apply for food assistance. Eligible households receive free meals and help accessing benefits. Call us for application help and eligibility details.</p>${links}</main></html>`;
const anchor = (url, text = "Apply for food assistance") => `<a href="${url}">${text}</a>`;

function setup(responses, overrides = {}) {
  const calls = [];
  const cached = new Map();
  const client = {
    stats: {},
    async get(url, options) {
      calls.push({ url, options });
      const value = responses[url];
      if (value instanceof Error) throw value;
      const response = typeof value === "function" ? await value(options) : value;
      return { url, status: 200, contentType: "text/html", headers: {}, text: "", ...(typeof response === "string" ? { text: response } : response ?? { status: 404 }) };
    },
    async robots() { return { sitemaps: [], allowed: () => true }; },
    ...overrides,
  };
  return {
    calls, cached,
    dependencies: { client, cache: { read: async (url) => cached.get(url), write: async (url, value) => cached.set(url, value) } },
  };
}
const settings = { maxSitemaps: 0, concurrency: 3, maxTotalPages: 30 };

describe("bounded assistance discovery", () => {
  it("starts CA.gov first, then follows links between registered source scopes", async () => {
    const a = source();
    const b = source("second", { crawlOrder: 1, priority: 100 });
    const { calls, dependencies } = setup({
      [a.startUrl]: page("CalFresh", anchor("https://second.ca.gov/food-program")),
      [b.startUrl]: page("Utility assistance"),
      "https://second.ca.gov/food-program": page("Meals for families"),
    });
    const result = await crawlSources([b, a], settings, dependencies);
    expect(calls[0].url).toBe(a.startUrl);
    expect(result.sources.find((s) => s.id === "second").pages.map((p) => p.url)).toContain("https://second.ca.gov/food-program");
  });

  it("reserves the first origin even when a small queue evicts low-priority seeds", async () => {
    const a = source();
    const b = source("county", { crawlOrder: 1, priority: 100 });
    const { calls, dependencies } = setup({ [a.startUrl]: page("CalFresh"), [b.startUrl]: page("Family meals") });
    const result = await crawlSources([b, a], { ...settings, maxQueue: 1 }, dependencies);
    expect(calls[0].url).toBe(a.startUrl);
    expect(result.summary.keptPages).toBe(2);
    expect(result.summary.queueLimitReached).toBe(true);
  });

  it("keeps a successful redirect response even when the direct destination request fails", async () => {
    const a = source();
    const { dependencies } = setup({
      [a.startUrl]: page("CalFresh", anchor("/target") + anchor("/alias")),
      "https://first.ca.gov/target": async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { status: 503 };
      },
      "https://first.ca.gov/alias": { url: "https://first.ca.gov/target", text: page("Meals for children") },
    });
    const result = await crawlSources([a], settings, dependencies);
    expect(result.sources[0].pages.some((p) => p.url === "https://first.ca.gov/target")).toBe(true);
  });

  it("stops scheduling once the network budget is exhausted", async () => {
    const a = source();
    const { calls, dependencies } = setup({
      [a.startUrl]: page("CalFresh", anchor("/a") + anchor("/b") + anchor("/c")),
      "https://first.ca.gov/a": Object.assign(new Error("Request budget reached"), { code: "REQUEST_LIMIT" }),
    });
    const result = await crawlSources([a], { ...settings, concurrency: 1 }, dependencies);
    expect(calls).toHaveLength(2);
    expect(result.summary.requestLimitReached).toBe(true);
    expect(result.summary.pendingPages).toBe(2);
  });

  it("deduplicates tracking URLs and records identical content once", async () => {
    const a = source();
    const same = page("Food pantry");
    const { calls, dependencies } = setup({
      [a.startUrl]: page("CalFresh", anchor("/program?utm_source=email#apply") + anchor("/program") + anchor("/mirror")),
      "https://first.ca.gov/program": same,
      "https://first.ca.gov/mirror": same,
    });
    const result = await crawlSources([a], settings, dependencies);
    expect(calls.filter((c) => c.url === "https://first.ca.gov/program")).toHaveLength(1);
    expect(result.summary.duplicates).toBe(1);
    expect(result.summary.keptPages).toBe(2);
  });

  it("deduplicates repeated program pages by name and description despite differing page content", async () => {
    const a = source();
    const description = "CalFresh offers food assistance to eligible households in California through a county application process.";
    const program = (extra) => `<html><head><title>CalFresh | California</title><meta name="description" content="${description}"></head><main><h1>CalFresh</h1><p>Apply for food assistance. ${extra}</p></main></html>`;
    const { dependencies } = setup({
      [a.startUrl]: page("Food programs", anchor("/program") + anchor("/copy")),
      "https://first.ca.gov/program": program("Applications are processed by county offices."),
      "https://first.ca.gov/copy": program("This page also links to a newsletter and outreach materials."),
    });
    const result = await crawlSources([a], settings, dependencies);
    expect(result.sources[0].pages.filter((item) => item.title.startsWith("CalFresh"))).toHaveLength(1);
    expect(result.sources[0].duplicates.some((item) => item.reason === "same_program_name_and_description")).toBe(true);
  });

  it("retains external providers and PDFs without fetching them", async () => {
    const a = source();
    const { calls, dependencies } = setup({ [a.startUrl]: page("Food pantry", anchor("https://provider.org/get-help") + anchor("/application.pdf")) });
    const result = await crawlSources([a], settings, dependencies);
    expect(calls).toHaveLength(1);
    expect(result.sources[0].discoveries.map((d) => d.reason).sort()).toEqual(["document_needs_extraction", "outside_configured_sources"]);
  });

  it("retains provider contact pages and blocked external redirects, but ignores social shares", async () => {
    const a = source();
    const { dependencies } = setup({
      [a.startUrl]: page("Food pantry", anchor("https://provider.org/contact-us", "Contact our food pantry") + anchor("https://facebook.com/sharer.php?u=test", "Share") + anchor("/apply")),
      "https://first.ca.gov/apply": Object.assign(new Error("Outside scope"), { code: "SCOPE", url: "https://benefits.example.org/application" }),
    });
    const result = await crawlSources([a], settings, dependencies);
    expect(result.sources[0].discoveries.map((d) => d.url).sort()).toEqual(["https://benefits.example.org/application", "https://provider.org/contact-us"]);
  });

  it("still discovers programs from an irrelevant intermediary page", async () => {
    const a = source();
    const { dependencies } = setup({
      [a.startUrl]: `<main><h1>Department directory</h1>${anchor("/food", "Visit the program")}</main>`,
      "https://first.ca.gov/food": page("Food pantry"),
    });
    const result = await crawlSources([a], settings, dependencies);
    expect(result.summary.skippedIrrelevant).toBe(1);
    expect(result.sources[0].pages[0].url).toBe("https://first.ca.gov/food");
  });

  it("counts errors against page budgets and prioritizes assistance links", async () => {
    const a = source();
    const { calls, dependencies } = setup({
      [a.startUrl]: page("Food pantry", anchor("/about", "About the department") + anchor("/program") + anchor("/other")),
      "https://first.ca.gov/program": { status: 503 },
    });
    const result = await crawlSources([a], { ...settings, maxPages: 2 }, dependencies);
    expect(calls.map((c) => c.url)).toEqual([a.startUrl, "https://first.ca.gov/program"]);
    expect(result.summary.attemptedPages).toBe(2);
    expect(result.summary.errors).toBe(1);
    expect(result.summary.pendingPages).toBe(2);
  });

  it("obeys global budgets and keeps the pending frontier reviewable", async () => {
    const a = source();
    const b = source("second");
    const { calls, dependencies } = setup({ [a.startUrl]: page("Food pantry", anchor("/program")) });
    const result = await crawlSources([a, b], { ...settings, maxTotalPages: 1 }, dependencies);
    expect(calls).toHaveLength(1);
    expect(result.summary.pendingPages).toBe(2);
    expect(result.sources[0].pendingUrls[0].url).toBe("https://first.ca.gov/program");
  });

  it("bounds depth and queue size without losing the fact that more leads exist", async () => {
    const a = source();
    const { calls, dependencies } = setup({ [a.startUrl]: page("Food pantry", anchor("/a") + anchor("/b") + anchor("/c")) });
    const depth = await crawlSources([a], { ...settings, maxDepth: 0 }, dependencies);
    expect(calls).toHaveLength(1);
    expect(depth.sources[0].discoveries.every((d) => d.reason === "depth_limit")).toBe(true);
    const queue = await crawlSources([a], { ...settings, maxQueue: 2, maxTotalPages: 1 }, dependencies);
    expect(queue.summary.pendingPages).toBe(2);
    expect(queue.summary.queueLimitReached).toBe(true);
  });

  it("uses cached HTML on 304 and reruns extraction instead of trusting old classifications", async () => {
    const a = source();
    const { cached, calls, dependencies } = setup({ [a.startUrl]: { status: 304 } });
    cached.set(a.startUrl, { url: a.startUrl, etag: '"v1"', contentType: "text/html", text: page("CalFresh") });
    const result = await crawlSources([a], settings, dependencies);
    expect(calls[0].options.headers["if-none-match"]).toBe('"v1"');
    expect(result.summary.cacheRevalidations).toBe(1);
    expect(result.sources[0].pages[0].fetchStatus).toBe("not_modified");
  });

  it("finds orphan program URLs through a bounded sitemap index", async () => {
    const a = source();
    const { calls, dependencies } = setup({
      [a.startUrl]: page("CalFresh"),
      "https://first.ca.gov/sitemap.xml": { contentType: "application/xml", text: `<sitemapindex><sitemap><loc>https://first.ca.gov/programs.xml</loc></sitemap></sitemapindex>` },
      "https://first.ca.gov/programs.xml": { contentType: "application/xml", text: `<sm:urlset xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"><sm:url><sm:loc>https://first.ca.gov/food-assistance</sm:loc></sm:url><sm:url><sm:loc>https://elsewhere.org/program</sm:loc></sm:url></sm:urlset>` },
      "https://first.ca.gov/food-assistance": page("Free meals"),
    });
    const result = await crawlSources([a], { ...settings, maxSitemaps: 2 }, dependencies);
    expect(calls).toHaveLength(4);
    expect(result.sources[0].pages.find((p) => p.title === "Free meals").discoveredFrom).toBe("https://first.ca.gov/programs.xml");
  });

  it("flags HTTP 200 challenge pages and JavaScript shells instead of calling them irrelevant", async () => {
    const a = source();
    const b = source("second");
    const { dependencies } = setup({
      [a.startUrl]: '<html><body>Request unsuccessful. Incapsula incident ID: 123</body></html>',
      [b.startUrl]: '<html><title>Benefits portal</title><div id="app"></div><noscript>You need to enable JavaScript to run this app.</noscript></html>',
    });
    const result = await crawlSources([a, b], settings, dependencies);
    expect(result.sources.flatMap((s) => s.errors).map((e) => e.code)).toEqual(["ACCESS_CHALLENGE", "JAVASCRIPT_REQUIRED"]);
    expect(result.summary.skippedIrrelevant).toBe(0);
  });
});

describe("URL policy and options", () => {
  it("preserves program identifiers while normalizing tracking and query order", () => {
    expect(normalizeUrl("https://first.ca.gov/program?utm_source=email&b=2&a=1#apply")).toBe("https://first.ca.gov/program?a=1&b=2");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("https://user:password@first.ca.gov/")).toBeNull();
    expect(inSourceScope("https://first.ca.gov/anywhere", source())).toBe(true);
    expect(inSourceScope("https://first.ca.gov.evil.test/", source())).toBe(false);
    expect(inSourceScope("https://first.ca.gov/services-extra", source("first", { allowedPathPrefixes: ["/services"] }))).toBe(false);
    expect(crawlTrap("https://first.ca.gov/search?q=rent")).toBe(true);
  });

  it("rejects unsafe/unbounded options and supports paths containing equals signs", () => {
    expect(() => parseOptions(["--concurrency=0"])).toThrow();
    expect(() => parseOptions(["--max-pages=-1"])).toThrow();
    expect(() => parseOptions(["--only=missing-source"])).toThrow();
    expect(parseOptions(["--output=data/test=one.json", "--max-sitemaps=0"]).output).toBe("data/test=one.json");
  });
});
