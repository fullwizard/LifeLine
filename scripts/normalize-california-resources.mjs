#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeJsonAtomic } from "./crawler/cache.mjs";

const DEFAULT_INPUT = "data/crawl-output/california-resource-pages.json";
const DEFAULT_OUTPUT = "data/crawl-output/california-resource-candidates.json";
const CATEGORY_BY_TOPIC = [
  ["shelter", "shelter"],
  ["rental_assistance", "rental_assistance"],
  ["food", "food"],
  ["utility", "utility"],
  ["legal", "legal"],
  ["employment", "employment"],
  ["substance_use_disorder", "substance_use"],
  ["mental_health_condition", "mental_health"],
  ["condition_support", "condition_support"],
  ["disability", "disability"],
  ["veteran_support", "veteran_support"],
  ["older_adult_support", "older_adult_support"],
  ["family_support", "family_support"],
  ["public_benefits", "benefits"],
  ["health_care", "health"],
  ["diabetes", "condition_support"],
  ["cancer", "condition_support"],
  ["chronic_illness", "condition_support"],
  ["heart_disease", "condition_support"],
  ["kidney_disease", "condition_support"],
  ["respiratory_condition", "condition_support"],
  ["hiv_aids", "condition_support"],
];
const ACTION_TEXT = /\b(?:apply|application|enroll|enrollment|register|sign up|get help|request (?:help|assistance)|find (?:help|a service|a program)|contact|call)\b/i;
const PROGRAM_TEXT = /\b(?:program|service|assistance|benefits?|support|resources?|help|apply|application)\b/i;

export function slugify(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "resource";
}

function stableId(name, url) {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 10);
  return `${slugify(name)}-${hash}`;
}

function clean(value, max = 800) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function programNameKey(value) {
  return clean(value, 220)
    .toLowerCase()
    .replace(/\b(?:outreach|expansion|program|programs|services?|service|page|application)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function duplicateKey(candidate) {
  const acronym = candidate.name.match(/\b[A-Z]{2,}\b/)?.[0]?.toLowerCase();
  if (acronym) {
    return [
      candidate.organization.toLowerCase(),
      acronym,
      candidate.category ?? "uncategorized",
      [...candidate.service_area].sort().join("|").toLowerCase(),
    ].join("\u001f");
  }
  return [
    candidate.organization.toLowerCase(),
    programNameKey(candidate.name),
    candidate.category ?? "uncategorized",
    [...candidate.service_area].sort().join("|").toLowerCase(),
    clean(candidate.description, 900).toLowerCase(),
  ].join("\u001f");
}

function isNavigationPage(name, description = "") {
  if (/^(?:how to apply|other resources?|partners?|contact us|home|welcome|about us|faq|frequently asked questions?)\??$/i.test(name.trim())) return true;
  return description.trim().length < 80 && /\b(?:outreach|partners?|other resources?)\b/i.test(name);
}

function categoryFor(page) {
  const evidence = [page.title, ...(page.headings ?? []).slice(0, 4), page.description, page.excerpt].join(" ");
  const strongSignals = [
    ["shelter", /\b(?:emergency shelter|temporary shelter|homeless shelter|homeless(?:ness)? assistance|shelter services?)\b/i],
    ["rental_assistance", /\b(?:rental assistance|rent assistance|eviction (?:prevention|help)|housing (?:assistance|support|programs?))\b/i],
    ["food", /\b(?:food assistance|food bank|food pantry|calfresh|snap|wic|free meals?|meal program)\b/i],
    ["utility", /\b(?:utility assistance|energy assistance|liheap|help (?:with|paying) (?:your )?(?:energy|utility|electric|water) bills?)\b/i],
    ["legal", /\b(?:legal aid|legal help|legal services?|tenant rights|free or low-cost legal)\b/i],
    ["employment", /\b(?:employment assistance|job training|job search|workforce development|unemployment benefits|services for job seekers?)\b/i],
    ["substance_use", /\b(?:substance use|addict(?:ed|ion)|recovery|rehab|detox|opioid|meth(?:amphetamine)?|fentanyl|cocaine|heroin)\b/i],
    ["mental_health", /\b(?:mental health|behavioral health|counseling|depression|anxiety|ptsd|bipolar|schizophrenia)\b/i],
  ];
  const matches = strongSignals.filter(([, pattern]) => pattern.test(evidence)).map(([category]) => category);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    for (const [topic, category] of CATEGORY_BY_TOPIC) if (matches.includes(category) && page.relevance?.topics?.includes(topic)) return category;
  }
  for (const [topic, category] of CATEGORY_BY_TOPIC.slice(6)) {
    if (page.relevance?.topics?.includes(topic)) return category;
  }
  return null;
}

function bestApplicationLink(page) {
  const titleWords = new Set(clean(`${page.title} ${(page.headings ?? []).slice(0, 2).join(" ")}`).toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3));
  const usable = (page.links ?? []).filter((link) => {
    if (link.navigation || !ACTION_TEXT.test(link.text ?? "")) return false;
    const linkWords = new Set(clean(link.text).toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3));
    const overlap = [...linkWords].some((word) => titleWords.has(word));
    return overlap || /\b(?:apply now|request (?:help|assistance)|contact us|find help)\b/i.test(link.text);
  });
  usable.sort((a, b) => Number(/\b(?:apply|application|enroll|register)\b/i.test(b.text)) - Number(/\b(?:apply|application|enroll|register)\b/i.test(a.text)));
  return usable[0] ?? null;
}

function usefulLinks(page) {
  return (page.links ?? [])
    .filter((link) => !link.navigation && (PROGRAM_TEXT.test(link.text ?? "") || link.related))
    .slice(0, 40)
    .map((link) => ({ url: link.url, text: clean(link.text, 180), context: clean(link.context, 600), ...(link.related ? { related: true } : {}) }));
}

function makeCandidate(page, source, generatedAt) {
  const topics = page.relevance?.topics ?? [];
  const rawName = clean(page.title, 180) || clean(page.headings?.[0], 180) || new URL(page.url).pathname;
  const name = clean(rawName.split(/\s+\|\s+/)[0], 180);
  const application = bestApplicationLink(page);
  const description = clean(page.description || page.excerpt || page.text, 900);
  const contacts = page.contacts ?? { phones: [], emails: [] };
  const category = categoryFor(page);
  const evidence = {
    pageTitle: name,
    excerpt: clean(page.excerpt || page.text, 1_200),
    matchedTerms: page.relevance?.matchedTerms ?? [],
    topics,
    sourceType: source.sourceType ?? "official",
    ...(source.evidenceUrls?.length ? { countyReferralUrls: source.evidenceUrls } : {}),
    ...(page.canonicalUrl ? { canonicalUrl: page.canonicalUrl } : {}),
  };

  return {
    id: stableId(name, page.canonicalUrl || page.url),
    name,
    organization: source.name,
    category,
    topics,
    description,
    service_area: [source.serviceArea],
    eligibility: {},
    required_documents: [],
    application_url: application?.url ?? page.url,
    source_url: page.url,
    phone: contacts.phones?.[0]?.value ?? null,
    email: contacts.emails?.[0]?.value ?? null,
    active: true,
    last_verified: generatedAt.slice(0, 10),
    reviewStatus: "needs_review",
    reviewReason: "Imported from source evidence; verify program scope, current status, service area, and eligibility before publishing.",
    evidence,
    linkedPrograms: usefulLinks(page),
  };
}

/** Convert crawl evidence into conservative, review-first candidate records. */
export function normalizeCrawl(crawl) {
  const generatedAt = new Date().toISOString();
  const candidates = [];
  const seen = new Set();
  const seenHashes = new Set();
  const seenCanonicalUrls = new Set();
  const candidateByKey = new Map();
  for (const source of crawl.sources ?? []) {
    for (const page of source.pages ?? []) {
      if (!page.relevance?.relevant) continue;
      const canonical = page.canonicalUrl || page.url;
      if (seenCanonicalUrls.has(canonical) || (page.contentHash && seenHashes.has(page.contentHash))) continue;
      seenCanonicalUrls.add(canonical);
      if (page.contentHash) seenHashes.add(page.contentHash);
      seen.add(canonical);
      const candidate = makeCandidate(page, source, generatedAt);
      if (isNavigationPage(candidate.name, candidate.description)) continue;
      const key = duplicateKey(candidate);
      const existing = candidateByKey.get(key);
      if (existing) {
        existing.linkedPrograms = [...new Map(
          [...(existing.linkedPrograms ?? []), ...(candidate.linkedPrograms ?? [])].map((link) => [link.url, link]),
        ).values()];
        continue;
      }
      candidateByKey.set(key, candidate);
      candidates.push(candidate);
    }
  }
  candidates.sort((a, b) => a.name.localeCompare(b.name) || a.source_url.localeCompare(b.source_url));
  const categoryCounts = Object.fromEntries(CATEGORY_BY_TOPIC.map(([, category]) => [category, 0]));
  let uncategorized = 0;
  for (const candidate of candidates) {
    if (candidate.category) categoryCounts[candidate.category] += 1;
    else uncategorized += 1;
  }
  return {
    schemaVersion: 1,
    generatedAt,
    input: {
      generatedAt: crawl.generatedAt ?? null,
      schemaVersion: crawl.schemaVersion ?? null,
      complete: crawl.complete === true,
      summary: crawl.summary ?? null,
    },
    policy: {
      generatedBy: "deterministic-normalizer",
      reviewRequired: true,
      unknownFieldsRemainUnknown: true,
      noEligibilityInferred: true,
      serviceAreaIsSourceHint: true,
    },
    summary: {
      candidates: candidates.length,
      categoryCounts,
      uncategorized,
      sourcePagesConsidered: seen.size,
    },
    candidates,
  };
}

export async function main(args = process.argv.slice(2)) {
  const options = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT };
  for (const arg of args) {
    const match = /^--(input|output)=(.+)$/.exec(arg);
    if (!match) throw new Error(`Invalid option: ${arg}. Use --input=path and --output=path.`);
    options[match[1]] = match[2];
  }
  const crawl = JSON.parse(await readFile(resolve(options.input), "utf8"));
  const output = normalizeCrawl(crawl);
  await writeJsonAtomic(resolve(options.output), output);
  console.log(`Wrote ${output.summary.candidates} review candidates to ${resolve(options.output)}`);
  console.log(`Categories: ${JSON.stringify(output.summary.categoryCounts)}; uncategorized: ${output.summary.uncategorized}`);
  if (!output.input.complete) process.exitCode = 2;
  return output;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
