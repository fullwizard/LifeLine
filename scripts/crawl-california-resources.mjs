#!/usr/bin/env node

import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CALIFORNIA_CRAWL_SCOPE, CALIFORNIA_CRAWL_SOURCES, PLANNED_API_SOURCES } from "./california-crawl-sources.mjs";
import { crawlSources, DEFAULTS } from "./crawler/engine.mjs";
import { writeJsonAtomic } from "./crawler/cache.mjs";

export function parseOptions(args) {
  const values = { ...DEFAULTS, output: "data/crawl-output/california-resource-pages.json", only: null, cache: true };
  const numeric = {
    "max-pages": ["maxPages", 1, 10000],
    "max-total-pages": ["maxTotalPages", 1, 10000],
    concurrency: ["concurrency", 1, 8],
    "delay-ms": ["delayMs", 500, 60000],
    "timeout-ms": ["timeoutMs", 1000, 60000],
    "max-depth": ["maxDepth", 0, 10],
    "max-queue": ["maxQueue", 1, 20000],
    "max-sitemaps": ["maxSitemaps", 0, 10],
    "max-retries": ["maxRetries", 0, 3],
    "max-requests": ["maxRequests", 1, 20000],
  };
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") { values.help = true; continue; }
    if (arg === "--list-sources") { values.listSources = true; continue; }
    if (arg === "--no-cache") { values.cache = false; continue; }
    const match = /^--([^=]+)=(.+)$/.exec(arg);
    if (!match) throw new Error(`Invalid option: ${arg}. Use --help.`);
    const [, flag, value] = match;
    if (numeric[flag]) {
      const [key, min, max] = numeric[flag];
      const number = Number(value);
      if (!Number.isInteger(number) || number < min || number > max) throw new Error(`--${flag} must be an integer from ${min} to ${max}.`);
      values[key] = number;
    } else if (flag === "only") values.only = value.split(",").filter(Boolean);
    else if (flag === "output") values.output = value;
    else if (flag === "cache-dir") values.cacheDir = value;
    else throw new Error(`Unknown option: --${flag}`);
  }
  if (values.only?.some((id) => !CALIFORNIA_CRAWL_SOURCES.some((source) => source.id === id))) {
    throw new Error("Unknown source in --only. Use --list-sources to see available IDs.");
  }
  return values;
}

export async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  if (options.help) {
    console.log(`California assistance discovery (no AI; review required)

node scripts/crawl-california-resources.mjs [options]

  --list-sources              Show configured official source IDs
  --only=id,id                Limit to selected sources
  --max-pages=N              Attempts per source (including failed/skipped pages)
  --max-total-pages=N        Whole-run page budget (default 300)
  --concurrency=N            Parallel workers, 1-8 (default 4)
  --delay-ms=N               Minimum delay per origin, >=500 (default 1000)
  --timeout-ms=N             Per-request deadline (default 15000)
  --max-depth=N              Link depth, 0-10 (default 4)
  --max-queue=N              Pending URL limit (default 1500)
  --max-sitemaps=N           Sitemap fetches per origin, 0 to disable (default 2)
  --max-retries=N            Transient retries, 0-3 (default 2)
  --max-requests=N           Hard network-request limit (default 1200)
  --output=path              Review JSON output
  --cache-dir=path           Conditional HTML cache location
  --no-cache                 Disable conditional cache reads/writes

Starts with CA.gov unless --only excludes it. JSON includes kept pages,
skipped reasons, provider/document leads, pending URLs, and coverage totals.
PDF and JavaScript-only content is retained as leads, not fully extracted.`);
    return;
  }
  if (options.listSources) {
    for (const source of [...CALIFORNIA_CRAWL_SOURCES].sort((a, b) => a.crawlOrder - b.crawlOrder || b.priority - a.priority)) {
      console.log(`${source.id}\t${source.serviceArea}\t${source.name}`);
    }
    return;
  }
  const sources = CALIFORNIA_CRAWL_SOURCES.filter((source) => !options.only || options.only.includes(source.id));
  const outputPath = resolve(options.output);
  options.cacheDir = options.cache ? resolve(options.cacheDir ?? join(dirname(outputPath), ".cache")) : null;
  let lastCheckpoint = Date.now();
  const wrap = (result) => ({ ...result, scope: CALIFORNIA_CRAWL_SCOPE, plannedApiSources: PLANNED_API_SOURCES });
  const result = await crawlSources(sources, options, {
    onProgress: ({ attemptedPages, source, url }) => console.log(`[${attemptedPages}] ${source}: ${url}`),
    checkpoint: async (partial) => {
      if (Date.now() - lastCheckpoint < 15000) return;
      await writeJsonAtomic(outputPath, { ...wrap(partial), complete: false });
      lastCheckpoint = Date.now();
    },
  });
  await writeJsonAtomic(outputPath, { ...wrap(result), complete: true });
  console.log(`Saved ${result.summary.keptPages} relevant pages, ${result.summary.discoveries} leads, ${result.summary.skippedIrrelevant} irrelevant pages, and ${result.summary.errors} errors to ${outputPath}`);
  console.log(`Reused ${result.summary.cacheRevalidations} unchanged pages; ${result.summary.pendingPages} URLs remain within the frontier.`);
  if (result.summary.inspectedPages === 0) process.exitCode = 1;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
