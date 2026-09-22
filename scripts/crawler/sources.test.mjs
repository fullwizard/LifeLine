import assert from "node:assert/strict";
import { test } from "vitest";
import { CALIFORNIA_CRAWL_SCOPE, CALIFORNIA_CRAWL_SOURCES } from "../california-crawl-sources.mjs";
import { inSourceScope } from "./urls.mjs";

test("CA.gov remains the sole first origin and priority counties precede statewide sources", () => {
  const first = CALIFORNIA_CRAWL_SOURCES.filter((source) => source.crawlOrder === 0);
  assert.equal(first.length, 1);
  assert.equal(first[0].id, "ca-gov-assistance");
  assert.equal(new URL(first[0].startUrl).hostname, "www.ca.gov");
  const counties = CALIFORNIA_CRAWL_SOURCES.filter((source) =>
    CALIFORNIA_CRAWL_SCOPE.priorityCounties.includes(source.serviceArea));
  const statewide = CALIFORNIA_CRAWL_SOURCES.filter((source) => source.crawlOrder > 1);
  for (const county of CALIFORNIA_CRAWL_SCOPE.priorityCounties) {
    assert.ok(counties.some((source) => source.serviceArea === county), county);
  }
  for (const county of counties) {
    for (const source of statewide) {
      assert.ok(county.crawlOrder < source.crawlOrder);
      assert.ok(county.priority > source.priority);
    }
  }
});

test("every source has unique identity, bounded budget, and seeds allowed by its scope", () => {
  assert.equal(new Set(CALIFORNIA_CRAWL_SOURCES.map((source) => source.id)).size,
    CALIFORNIA_CRAWL_SOURCES.length);
  for (const source of CALIFORNIA_CRAWL_SOURCES) {
    const seeds = [source.startUrl, ...(source.startUrls ?? [])];
    assert.equal(new Set(seeds).size, seeds.length, `${source.id} duplicate seed`);
    assert.ok(Number.isSafeInteger(source.maxPages) && source.maxPages >= seeds.length);
    for (const seed of seeds) {
      assert.equal(new URL(seed).protocol, "https:", seed);
      assert.ok(inSourceScope(seed, source), `${source.id} rejects its seed ${seed}`);
    }
    for (const origin of source.allowedOrigins) {
      assert.equal(origin, new URL(origin).origin);
      const spoofed = new URL(origin);
      spoofed.hostname += ".example.org";
      assert.equal(inSourceScope(spoofed.href, source), false);
    }
  }
});

test("department scopes reach actual service pages outside their directory path", () => {
  const scope = (id) => CALIFORNIA_CRAWL_SOURCES.find((source) => source.id === id);
  assert.ok(inSourceScope(
    "https://osh.santaclaracounty.gov/temporary-and-emergency-shelter",
    scope("santa-clara-supportive-housing"),
  ));
  assert.ok(inSourceScope(
    "https://osh.santaclaracounty.gov/housing-and-shelter-support/shelter-and-housing-support/housing-support/coordinated-entry-get",
    scope("santa-clara-supportive-housing"),
  ));
  assert.ok(inSourceScope(
    "https://www.smchealth.org/bhrsservices",
    scope("san-mateo-health"),
  ));
  assert.ok(inSourceScope(
    "https://www.dhcs.ca.gov/services/diseases-and-conditions/",
    scope("california-health-care-services"),
  ));
  assert.equal(inSourceScope(
    "https://www.smcgov.org/hsa-not-an-approved-department/private",
    scope("san-mateo-human-services"),
  ), false);
  assert.equal(inSourceScope(
    "https://www.smcgov.org/hr/benefits-value-added-resource-flyer",
    scope("san-mateo-human-services"),
  ), false);
});

test("provider sources require county provenance and exclude donations and account portals", () => {
  const providers = CALIFORNIA_CRAWL_SOURCES.filter((source) => source.kind === "county_referenced_provider");
  assert.ok(providers.length > 0);
  for (const source of providers) {
    assert.ok(source.evidenceUrls?.some((value) => {
      const url = new URL(value);
      return url.protocol === "https:" &&
        /(^|\.)(?:smcgov\.org|santaclaracounty\.gov)$/.test(url.hostname);
    }), `${source.id} needs an official county referral`);
    assert.equal(source.crawlOrder, 1);
    assert.ok(source.priority < 100 && source.priority > 60);
    for (const origin of source.allowedOrigins) {
      assert.equal(inSourceScope(`${origin}/donate/`, source), false);
      assert.equal(inSourceScope(`${origin}/login/`, source), false);
      const portal = new URL(origin);
      portal.hostname = `apply.${portal.hostname.replace(/^www\./, "")}`;
      assert.equal(inSourceScope(portal.href, source), false);
    }
  }
  const sacredHeart = providers.find((source) => source.id === "sacred-heart-community-service");
  assert.ok(inSourceScope("https://www.sacredheartcs.org/programs-finding-a-job", sacredHeart));
  assert.ok(inSourceScope("https://www.sacredheartcs.org/deposit-assistance", sacredHeart));
  assert.equal(inSourceScope("https://www.sacredheartcs.org/programs-unreviewed", sacredHeart), false);
});
