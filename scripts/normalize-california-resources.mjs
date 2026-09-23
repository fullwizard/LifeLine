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
    .replace(/\s+-\s+(?:consumer|medicare services|state of california)\s*$/i, "")
    .replace(/\b(?:program|programs|services?|service|page)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function duplicateKey(candidate) {
  return [
    candidate.organization.toLowerCase(),
    programNameKey(candidate.name),
    candidate.category ?? "uncategorized",
    [...candidate.service_area].sort().join("|").toLowerCase(),
  ].join("\u001f");
}

function sharedProgramKey(candidate) {
  const name = programNameKey(candidate.name);
  // Generic service labels can refer to different local programs.
  if (name.length < 6 || /^(?:(?:food|housing|rental|utility|health|mental health|legal|veteran|family|employment|disability|community|human|social|senior|aging) )?(?:assistance|benefits|help|resources|support|programs|services)(?: (?:and|for|of) .*)?$/.test(name)) return null;
  return [name, candidate.category ?? "uncategorized"].join("\u001f");
}

function normalizedDescription(value) {
  return clean(value, 900)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function descriptionDuplicateKey(candidate) {
  const description = normalizedDescription(candidate.description);
  // Short or boilerplate descriptions are common on unrelated pages and are
  // not strong enough evidence that two records are the same program.
  if (description.length < 70 || /^(?:state of california|california state government)/.test(description)) return null;
  return [
    candidate.organization.toLowerCase(),
    candidate.category ?? "uncategorized",
    [...candidate.service_area].sort().join("|").toLowerCase(),
    description,
  ].join("\u001f");
}

function isNavigationPage(name, description = "", url = "") {
  const baseName = name.replace(/\s+-\s+(?:consumer|state of california)\s*$/i, "").trim();
  if (/^(?:how to apply|other resources?|partners?|contact us|home|welcome|about us|faq|frequently asked questions?|find services in my county|assistance and social programs|find assistance|programs? & services?|benefits? & services?|human services|local resources|program support|who is eligible|what is .+|applying for .+|.+ eligibility|.+ faq|become a volunteer|(?:housing|health|food|utility|rental|benefits|community|sacred heart) programs?|programs - .+|services|legal|community services)\??$/i.test(baseName)) return true;
  if (/\b(?:outreach materials|success stories|social media toolkit|resource videos|citizenship guide|frequently asked questions?|faq)\b|\s-\sHow Do I\s*$/i.test(name)) return true;
  if (/\/(?:job_fairs_and_workshops|social-media-toolkit|successstories|my_county)\//i.test(new URL(url).pathname)) return true;
  return description.trim().length < 80 && /\b(?:outreach|partners?|other resources?)\b/i.test(name);
}

function categoryFor(page, name, description) {
  const signals = [
    ["shelter", /\b(?:emergency shelter|temporary shelter|homeless shelter|homeless(?:ness)? assistance|shelter services?)\b/i],
    ["rental_assistance", /\b(?:rental assistance|rent assistance|eviction (?:prevention|help)|housing (?:assistance|support|programs?))\b/i],
    ["food", /\b(?:food assistance|food bank|food pantry|calfresh|snap|wic|free meals?|meal program)\b/i],
    ["utility", /\b(?:utility assistance|energy assistance|liheap|help (?:with|paying) (?:your )?(?:energy|utility|electric|water) bills?)\b/i],
    ["legal", /\b(?:legal aid|legal help|legal services?|tenant rights|free or low-cost legal|bankruptcy)\b/i],
    ["employment", /\b(?:employment assistance|job training|job search|workforce development|unemployment benefits|services for job seekers?)\b/i],
    ["benefits", /\b(?:earned income tax credit|cal(?:ifornia)?e?itc|tax credit|cash[- ]back tax credit|cash back tax credit)\b/i],
    ["substance_use", /\b(?:substance use|addict(?:ed|ion)|recovery|rehab|detox|opioid|meth(?:amphetamine)?|fentanyl|cocaine|heroin)\b/i],
    ["mental_health", /\b(?:mental health|behavioral health|mental health counseling|crisis counseling|depression|anxiety|ptsd|bipolar|schizophrenia)\b/i],
    ["veteran_support", /\b(?:veteran|calvet|military)\b/i],
    ["older_adult_support", /\b(?:seniors?|older adults?|aging|elderly|fall prevention|medicare counseling)\b/i],
    ["family_support", /\b(?:family caregiver|caregiver services|child care|childcare|parenting|pregnancy|maternal|foster)\b/i],
    ["disability", /\b(?:disability|disabilities|disabled|independent living|assistive technology)\b/i],
    ["health", /\b(?:health care|healthcare|medical care|clinic|medi[- ]cal)\b/i],
    ["condition_support", /\b(?:diabetes|cancer|hiv|aids|heart disease|kidney disease|asthma|copd)\b/i],
  ];
  // The page title describes this program. Site menus and related links do not.
  for (const [category, pattern] of signals) if (pattern.test(name)) return category;
  if (/\/housing-programs\//i.test(new URL(page.url).pathname)
    && /\b(?:housing|rental assistance|homelessness)\b/i.test(description.slice(0, 900))) return "rental_assistance";
  const intro = description.slice(0, 300);
  const matches = signals.filter(([, pattern]) => pattern.test(intro)).map(([category]) => category);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const first = signals.map(([category, pattern]) => ({ category, index: intro.search(pattern) }))
      .filter(({ index }) => index >= 0).sort((a, b) => a.index - b.index)[0];
    if (first) return first.category;
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

function bestDescription(page) {
  const title = clean(page.title?.split(/\s+\|\s+/)[0], 180).replace(/\s+-\s+(?:consumer|medicare services|care options)\s*$/i, "");
  const text = clean(page.text, 60_000);
  const normalizedTitle = normalizedDescription(title);
  const matchingHeading = (page.headings ?? []).find((heading) => {
    const normalizedHeading = normalizedDescription(heading);
    return normalizedHeading === normalizedTitle
      || (normalizedTitle.length >= 12 && normalizedHeading.startsWith(`${normalizedTitle} `)
        && normalizedHeading.length - normalizedTitle.length <= 40);
  });
  let focusedText = text;
  if (matchingHeading && text.length > 0) {
    const needle = clean(matchingHeading);
    let index = text.toLowerCase().indexOf(needle.toLowerCase());
    // Some templates repeat the title in a menu before the actual article.
    if (index >= 0 && index < 250) {
      const second = text.toLowerCase().indexOf(needle.toLowerCase(), index + needle.length);
      if (second >= 0 && second < 1500) index = second;
    }
    if (index >= 0) focusedText = text.slice(index);
  }
  const genericReferral = focusedText.search(/\bHow To Find Services In My Area\b/i);
  const serviceDetails = focusedText.search(/\bWhat Services Are Available\b/i);
  if (genericReferral >= 0 && genericReferral < 250 && serviceDetails > genericReferral && serviceDetails < 1200) {
    focusedText = focusedText.slice(serviceDetails + "What Services Are Available".length).trim();
  }
  const candidates = [focusedText, page.excerpt, page.description]
    .map((value) => clean(value, 900))
    .filter(Boolean);
  const meaningful = candidates.find((value) => value.length >= 100 && !/^(?:state of california|california state government)$/i.test(value));
  return meaningful ?? candidates.sort((a, b) => b.length - a.length)[0] ?? "";
}

const UNSTABLE_HOUSING = ["unhoused", "housed_at_risk", "eviction_notice"];

/**
 * Pull structured eligibility out of page evidence. Conservative by design:
 * only rules the page states in recognisable words are captured, anything
 * softer becomes a note, and every record stays `eligibility_verified: false`
 * until a person reviews it (see data/reviewed/eligibility-overrides.json).
 */
export function extractEligibility(page) {
  const evidence = [page.title, ...(page.headings ?? []), page.description, page.excerpt, page.text]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
  const eligibility = {};
  const notes = [];

  const annualIncome = evidence.match(/\b(?:earning|earns|income|incomes|gross income|annual income|yearly income)[^$\d]{0,45}\$\s*([\d,]+)\s*(?:a|per|each)?\s*(?:year|yr|annually)\b/i)
    ?? evidence.match(/\b(?:not more than|maximum income(?: allowed)?)[^$]{0,20}\$\s*([\d,]+)\b/i)
    ?? evidence.match(/\b(?:under|below|less than|no more than|up to)\s+\$\s*([\d,]+)\s*(?:a|per|each)?\s*(?:year|yr|annually)\b/i);
  if (annualIncome) {
    const amount = Number(annualIncome[1].replace(/,/g, ""));
    if (Number.isFinite(amount) && amount > 0) eligibility.max_annual_income = amount;
  }

  const ami = evidence.match(/\b(\d{2,3})\s*(?:%|percent)\s*(?:of\s+)?(?:the\s+)?(?:area median income|ami|median income)\b/i);
  if (ami) eligibility.max_ami_percent = Number(ami[1]);
  const fpl = evidence.match(/\b(\d{2,3})\s*(?:%|percent)\s*(?:of\s+)?(?:the\s+)?(?:federal poverty (?:level|line|guidelines?)|poverty (?:level|line|guidelines?)|fpl)\b/i);
  if (fpl) eligibility.max_fpl_percent = Number(fpl[1]);
  const smi = evidence.match(/\b(\d{2,3})\s*(?:%|percent)\s*(?:of\s+)?(?:the\s+)?state median income\b/i);
  if (smi) notes.push(`Income limit ${smi[1]}% of state median income.`);
  const anyIncomeRule = annualIncome || ami || fpl || smi;
  if (!anyIncomeRule && /\b(?:low[- ]income|income[- ]eligible|income[- ]qualified|income limits? appl(?:y|ies))\b/i.test(evidence)) {
    notes.push("Income limits apply; the amounts are not published on the page.");
  }

  if (/\b(?:must be (?:a )?veterans?|veterans? only|only (?:for|to) (?:eligible )?veterans|for (?:eligible|homeless|low-income) veterans|veterans and their families|serves veterans)\b/i.test(evidence)) {
    eligibility.requires_veteran = true;
  }
  if (/\b(?:families with (?:minor |dependent )?children|households with (?:minor |dependent )?children|must have (?:a|at least one) (?:minor |dependent )?child|families (?:in|receiving|on|enrolled in) (?:the )?calworks(?: program)?)\b/i.test(evidence)) {
    eligibility.requires_children = true;
  }

  const homeless = /\b(?:experiencing homelessness|who are homeless|homeless (?:individuals|families|adults|youth|people)|people experiencing homelessness|are homeless)\b/i.test(evidence);
  const atRisk = /\b(?:at risk of (?:homelessness|losing (?:their |your )?(?:housing|home)|eviction)|risk of homelessness|past[- ]due rent|behind on (?:their |your )?rent|eviction prevention|avoid(?:ing)? eviction|prevent eviction|eviction avoidance|homelessness prevention|facing eviction)\b/i.test(evidence);
  if (homeless && atRisk) eligibility.housing_status_any_of = [...UNSTABLE_HOUSING];
  else if (homeless) eligibility.housing_status_any_of = ["unhoused"];
  else if (atRisk) eligibility.housing_status_any_of = ["housed_at_risk", "eviction_notice"];

  if (/\b(?:must have (?:received )?(?:an? )?(?:eviction |written |court )?notice|with an eviction notice|received an? (?:eviction|3-day|three-day|pay or quit) notice|unlawful detainer (?:case|filed|lawsuit))\b/i.test(evidence)) {
    eligibility.requires_eviction_notice = true;
  }

  if (/\b(?:calworks (?:recipients?|participants?|families|applicants?)|in the calworks program|receiving calworks|families in calworks)\b/i.test(evidence)) {
    notes.push("Must be receiving (or applying for) CalWORKs.");
  }
  if (/\b(?:adult protective services|aps clients?)\b/i.test(evidence)) {
    notes.push("Must be an Adult Protective Services client or in APS intake.");
  }
  if (/\bchild welfare\b/i.test(evidence)) {
    notes.push("Family must be involved with the child welfare system.");
  }
  const resident = evidence.match(/\bresident of ([A-Z][\w .]+? County)(?: for at least (\d+|thirty|sixty|ninety) days)?/i);
  if (resident) notes.push(`Must be a resident of ${resident[1].trim()}${resident[2] ? ` for at least ${resident[2]} days` : ""}.`);
  const zipBlock = evidence.match(/\bzip codes?\b(.{0,600})/i);
  if (zipBlock) {
    const zips = [...new Set(zipBlock[1].match(/\b9\d{4}\b/g) ?? [])];
    if (zips.length >= 2) notes.push(`Serves ZIP codes ${zips.join(", ")}.`);
  }

  if (notes.length) eligibility.notes = notes.join(" ");
  return eligibility;
}

function organizationFor(page, source) {
  if (/\b(?:earned income tax credit|caleitc)\b/i.test(`${page.title} ${page.excerpt} ${page.text}`)) {
    return "California Franchise Tax Board";
  }
  return source.name;
}

function mergeCandidate(existing, candidate) {
  const existingLinks = existing.linkedPrograms ?? [];
  const candidateLinks = candidate.linkedPrograms ?? [];
  const candidateIsPrimary = /ftb\.ca\.gov$/i.test(new URL(candidate.source_url).hostname) && /earned income tax credit|caleitc/i.test(candidate.source_url);
  const candidateIsGovernment = /(?:^|\.)ca\.gov$/i.test(new URL(candidate.source_url).hostname);
  const existingIsGovernment = /(?:^|\.)ca\.gov$/i.test(new URL(existing.source_url).hostname);
  const existingHasEligibility = Object.keys(existing.eligibility ?? {}).length > 0;
  const candidateHasEligibility = Object.keys(candidate.eligibility ?? {}).length > 0;
  const shouldReplace = (candidateIsPrimary && (candidateHasEligibility || !existingHasEligibility))
    || (candidateIsGovernment && !existingIsGovernment && (candidateHasEligibility || !existingHasEligibility))
    || (!existingHasEligibility && candidateHasEligibility);
  if (shouldReplace) Object.assign(existing, candidate);
  existing.linkedPrograms = [...new Map(
    [...existingLinks, ...candidateLinks].map((link) => [link.url, link]),
  ).values()];
}

function makeCandidate(page, source, generatedAt) {
  const topics = page.relevance?.topics ?? [];
  const rawName = clean(page.title, 180) || clean(page.headings?.[0], 180) || new URL(page.url).pathname;
  const pageEvidence = `${page.url} ${page.title} ${(page.headings ?? []).slice(0, 1).join(" ")}`;
  const name = /\b(?:earned income tax credit|caleitc)\b/i.test(pageEvidence)
    ? "California Earned Income Tax Credit"
    : clean(rawName.split(/\s+\|\s+/)[0], 180);
  const application = bestApplicationLink(page);
  const description = bestDescription(page);
  const contacts = page.contacts ?? { phones: [], emails: [] };
  const category = categoryFor(page, name, description);
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
    organization: organizationFor(page, source),
    category,
    topics,
    description,
    service_area: [source.serviceArea],
    eligibility: extractEligibility(page),
    eligibility_verified: false,
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
  const candidateBySharedProgram = new Map();
  for (const source of crawl.sources ?? []) {
    for (const page of source.pages ?? []) {
      if (!page.relevance?.relevant) continue;
      const canonical = page.canonicalUrl || page.url;
      if (seenCanonicalUrls.has(canonical) || (page.contentHash && seenHashes.has(page.contentHash))) continue;
      seenCanonicalUrls.add(canonical);
      if (page.contentHash) seenHashes.add(page.contentHash);
      seen.add(canonical);
      const candidate = makeCandidate(page, source, generatedAt);
      if (isNavigationPage(candidate.name, candidate.description, candidate.source_url)) continue;
      const key = duplicateKey(candidate);
      const descriptionKey = descriptionDuplicateKey(candidate);
      const sharedKey = sharedProgramKey(candidate);
      const existing = candidateByKey.get(key)
        ?? (descriptionKey ? candidateByKey.get(`description:${descriptionKey}`) : undefined)
        ?? (sharedKey ? candidateBySharedProgram.get(sharedKey) : undefined);
      if (existing) {
        mergeCandidate(existing, candidate);
        candidateByKey.set(key, existing);
        if (descriptionKey) candidateByKey.set(`description:${descriptionKey}`, existing);
        if (sharedKey) candidateBySharedProgram.set(sharedKey, existing);
        continue;
      }
      candidateByKey.set(key, candidate);
      if (descriptionKey) candidateByKey.set(`description:${descriptionKey}`, candidate);
      if (sharedKey) candidateBySharedProgram.set(sharedKey, candidate);
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
