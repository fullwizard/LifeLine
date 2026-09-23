/**
 * Promote reviewed crawl output into the file the app actually loads.
 *
 *   data/crawl-output/california-resource-candidates.json   (from normalize)
 * + data/reviewed/eligibility-overrides.json                (human review)
 * → data/resources.json                                     (what the app imports)
 *
 * Every record is validated against the Resource contract in lib/types.ts.
 * Any problem fails the run so a bad crawl can never reach the app.
 *
 *   node scripts/promote-resources.mjs [--candidates=path] [--overrides=path] [--output=path]
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractEligibility } from "./normalize-california-resources.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULTS = {
  candidates: path.join(ROOT, "data/crawl-output/california-resource-candidates.json"),
  overrides: path.join(ROOT, "data/reviewed/eligibility-overrides.json"),
  output: path.join(ROOT, "data/resources.json"),
};

export const CATEGORIES = [
  "rental_assistance", "food", "utility", "shelter", "employment", "legal", "health", "benefits",
  "family_support", "veteran_support", "older_adult_support", "disability", "mental_health",
  "substance_use", "condition_support",
];
const HOUSING_STATUSES = ["housed_stable", "housed_at_risk", "eviction_notice", "unhoused"];
const ELIGIBILITY_KEYS = {
  max_annual_income: "number",
  max_ami_percent: "number",
  max_fpl_percent: "number",
  requires_eviction_notice: "boolean",
  requires_children: "boolean",
  requires_veteran: "boolean",
  housing_status_any_of: "housing_statuses",
  notes: "string",
};
const OVERRIDE_KEYS = new Set(["reviewed_at", "reviewed_by", "active", "eligibility_verified", "eligibility", "phone", "response_time_days", "required_documents"]);
// "US", "California", "Santa Clara County, CA", "Santa Clara and San Mateo counties, CA", "San Jose, CA"
const SERVICE_AREA = /^(?:US|California|[A-Z][\w .'-]+(?: and [A-Z][\w .'-]+)*(?: count(?:y|ies))?, CA)$/;

function isUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateEligibility(eligibility, where, errors) {
  if (typeof eligibility !== "object" || eligibility === null || Array.isArray(eligibility)) {
    errors.push(`${where}: eligibility must be an object`);
    return;
  }
  for (const [key, value] of Object.entries(eligibility)) {
    const expected = ELIGIBILITY_KEYS[key];
    if (!expected) errors.push(`${where}: unknown eligibility field "${key}"`);
    else if (expected === "housing_statuses") {
      if (!Array.isArray(value) || value.some((v) => !HOUSING_STATUSES.includes(v))) errors.push(`${where}: housing_status_any_of must list only ${HOUSING_STATUSES.join(", ")}`);
    } else if (typeof value !== expected) errors.push(`${where}: eligibility.${key} must be a ${expected}`);
    else if (expected === "number" && !(value > 0)) errors.push(`${where}: eligibility.${key} must be positive`);
  }
}

export function validateResource(resource, errors) {
  const where = resource?.id ?? "<no id>";
  for (const field of ["id", "name", "organization", "description", "application_url", "source_url"]) {
    if (typeof resource[field] !== "string" || !resource[field].trim()) errors.push(`${where}: ${field} is required`);
  }
  if (!CATEGORIES.includes(resource.category)) errors.push(`${where}: category "${resource.category}" is not one of ${CATEGORIES.join(", ")}`);
  if (!Array.isArray(resource.service_area) || resource.service_area.length === 0) errors.push(`${where}: service_area must be a non-empty array`);
  else for (const area of resource.service_area) if (!SERVICE_AREA.test(area)) errors.push(`${where}: service_area entry "${area}" is not in a recognised format`);
  if (typeof resource.active !== "boolean") errors.push(`${where}: active must be boolean`);
  if (!Array.isArray(resource.required_documents) || resource.required_documents.some((d) => typeof d !== "string")) errors.push(`${where}: required_documents must be an array of strings`);
  for (const field of ["application_url", "source_url"]) if (typeof resource[field] === "string" && !isUrl(resource[field])) errors.push(`${where}: ${field} is not a valid http(s) URL`);
  if (resource.phone !== undefined && resource.phone !== null && typeof resource.phone !== "string") errors.push(`${where}: phone must be a string`);
  if (resource.eligibility_verified !== undefined && typeof resource.eligibility_verified !== "boolean") errors.push(`${where}: eligibility_verified must be boolean`);
  if (resource.response_time_days !== undefined && !(typeof resource.response_time_days === "number" && resource.response_time_days >= 0)) errors.push(`${where}: response_time_days must be a non-negative number`);
  validateEligibility(resource.eligibility ?? {}, where, errors);
}

/** Apply a reviewed override to a candidate. Returns the promoted resource. */
export function applyOverride(candidate, override) {
  const out = { ...candidate };
  if (!override) return out;
  if (override.eligibility) {
    out.eligibility = { ...override.eligibility };
    out.eligibility_verified = override.eligibility_verified ?? true;
  } else if (override.eligibility_verified !== undefined) {
    out.eligibility_verified = override.eligibility_verified;
  }
  if (override.active !== undefined) out.active = override.active;
  if (override.phone !== undefined) out.phone = override.phone;
  if (override.response_time_days !== undefined) out.response_time_days = override.response_time_days;
  if (override.required_documents !== undefined) out.required_documents = [...override.required_documents];
  if (override.reviewed_at) out.last_verified = override.reviewed_at;
  return out;
}

/**
 * Older crawl output predates the eligibility extractor. When a record has no
 * eligibility and no override, run the extractor over its stored evidence so
 * the app still sees the rules the page states. Stays unverified.
 */
export function backfillEligibility(candidate) {
  if (Object.keys(candidate.eligibility ?? {}).length > 0) return candidate;
  const evidence = candidate.evidence ?? {};
  const extracted = extractEligibility({
    title: candidate.name,
    description: candidate.description,
    excerpt: evidence.excerpt,
    text: "",
  });
  return Object.keys(extracted).length ? { ...candidate, eligibility: extracted, eligibility_verified: false } : candidate;
}

function toResource(candidate) {
  return {
    id: candidate.id,
    name: candidate.name,
    organization: candidate.organization,
    category: candidate.category,
    description: candidate.description,
    service_area: candidate.service_area,
    active: candidate.active,
    eligibility: candidate.eligibility ?? {},
    eligibility_verified: candidate.eligibility_verified ?? false,
    required_documents: candidate.required_documents ?? [],
    application_url: candidate.application_url,
    source_url: candidate.source_url,
    ...(candidate.phone ? { phone: candidate.phone } : {}),
    ...(candidate.response_time_days !== undefined ? { response_time_days: candidate.response_time_days } : {}),
    last_verified: candidate.last_verified,
  };
}

/** Pure: candidates + overrides → { resources, errors, warnings, stats }. */
export function promote(crawl, reviewed) {
  const errors = [];
  const warnings = [];
  const overrides = reviewed?.overrides ?? {};
  const candidates = crawl?.candidates ?? [];
  const byId = new Map(candidates.map((c) => [c.id, c]));

  for (const [id, override] of Object.entries(overrides)) {
    if (!byId.has(id)) warnings.push(`override "${id}" does not match any candidate (was the id renamed by a re-crawl?)`);
    for (const key of Object.keys(override)) if (!OVERRIDE_KEYS.has(key)) errors.push(`override "${id}": unknown field "${key}"`);
    if (!override.reviewed_at || !override.reviewed_by) errors.push(`override "${id}": reviewed_at and reviewed_by are required`);
    if (override.eligibility) validateEligibility(override.eligibility, `override "${id}"`, errors);
  }

  const resources = [];
  const seenIds = new Set();
  const seenApply = new Map();
  let skippedUncategorized = 0;
  for (const candidate of candidates) {
    if (!candidate.category) {
      skippedUncategorized += 1;
      continue;
    }
    if (seenIds.has(candidate.id)) {
      errors.push(`${candidate.id}: duplicate id`);
      continue;
    }
    seenIds.add(candidate.id);
    const override = overrides[candidate.id];
    const resource = toResource(applyOverride(override ? candidate : backfillEligibility(candidate), override));
    validateResource(resource, errors);
    const applyKey = resource.application_url?.toLowerCase();
    if (applyKey) {
      if (seenApply.has(applyKey)) warnings.push(`${resource.id} shares application_url with ${seenApply.get(applyKey)}; consider merging in the normalizer`);
      else seenApply.set(applyKey, resource.id);
    }
    resources.push(resource);
  }
  resources.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  const stats = {
    candidates: candidates.length,
    promoted: resources.length,
    skippedUncategorized,
    verified: resources.filter((r) => r.eligibility_verified).length,
    withEligibility: resources.filter((r) => Object.keys(r.eligibility).length > 0).length,
    backfilled: resources.filter((r) => !r.eligibility_verified && Object.keys(r.eligibility).length > 0).length,
    inactive: resources.filter((r) => !r.active).length,
  };
  return { resources, errors, warnings, stats };
}

export async function main(args = process.argv.slice(2)) {
  const options = { ...DEFAULTS };
  for (const arg of args) {
    const match = /^--(candidates|overrides|output)=(.+)$/.exec(arg);
    if (!match) throw new Error(`Invalid option: ${arg}`);
    options[match[1]] = path.resolve(match[2]);
  }
  const crawl = JSON.parse(await readFile(options.candidates, "utf8"));
  const reviewed = JSON.parse(await readFile(options.overrides, "utf8"));
  const { resources, errors, warnings, stats } = promote(crawl, reviewed);
  for (const w of warnings) console.warn(`warning: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`error: ${e}`);
    throw new Error(`${errors.length} validation error(s); data/resources.json was not written`);
  }
  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      candidatesGeneratedAt: crawl.generatedAt ?? null,
      overridesCount: Object.keys(reviewed.overrides ?? {}).length,
    },
    stats,
    resources,
  };
  await writeFile(options.output, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${resources.length} resources to ${path.relative(ROOT, options.output)} (${stats.verified} verified, ${stats.withEligibility} with eligibility, ${stats.inactive} inactive, ${stats.skippedUncategorized} uncategorized skipped)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
