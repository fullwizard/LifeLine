# LifeLine

An MVP web app that helps people facing housing instability get a prioritized,
explained plan of local assistance resources.

Describe your situation in plain language → answer at most one follow-up
question → get a ranked list of resources, each with a structured "why"
breakdown that separates **confirmed** facts from eligibility that still
**needs verification** with the organization.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest unit tests for the matching + follow-up engines
npm run typecheck
```

No API key or database is needed. Copy `.env.example` to `.env.local` and set
`GEMINI_API_KEY` to have Gemini parse free text and write the plan prose; with
it unset, a keyword parser and template explainer do the same job offline.

## Architecture

```
lib/types.ts            Shared contract: Situation, Resource, ScoredResource, Question, Plan
lib/matching/           PURE engine. No Next.js / Gemini / Supabase imports.
  gates.ts                Hard gates: inactive, wrong area, known contradictions → excluded
  score.ts                Scoring on survivors → number + breakdown[{factor,status,points,detail}]
  rank.ts                 Sort: score desc, fewer unverified, name
  index.ts                matchResources(resources, situation, context)
  matching.test.ts        Unit tests with hand-built fixtures
lib/followup/           Deterministic next-question selection (expected eliminations via gates)
lib/data/               getResources() → California crawl candidates today, Supabase later; AMI + place lookups
lib/gemini/             Parser + explainer interfaces; Gemini impls with deterministic fallbacks
lib/plan/buildPlan.ts   The only place the layers are wired together
app/                    Next.js App Router UI (server actions in app/actions.ts)
```

### Rules the code enforces

- **Gates, then scoring.** A resource is excluded outright for being inactive,
  serving the wrong area, or contradicting a *known* fact (e.g. veteran-only and
  the user said they are not a veteran). Only survivors are scored.
- **Unknown ≠ met.** Any requirement we cannot confirm from what the user said
  scores 0 points and is reported as `unverified`. The UI never says "you
  qualify".
- **AI never chooses.** Gemini only (a) turns free text into a `Situation` and
  (b) turns the already-ranked list into prose. Any resource id it returns that
  we did not send is discarded.
- **Income limits bracket by household size.** If household size is unknown,
  income under the 1-person limit is `met`, over the 8-person limit is
  excluded, and anything between is `unverified`.

## Swapping in real services

- **Supabase:** replace the body of `getResources()` in `lib/data/resources.ts`.
- **AMI data:** replace `lib/data/ami.ts` with a HUD income-limits lookup.
- **Geocoding:** replace `resolvePlace()` in `lib/data/places.ts`.

The local resource dataset is California focused and review-first; treat
them as fixtures, not a verified directory.

## California resource crawler

`npm run crawl:california` collects public assistance information into a local
JSON review queue. It starts with CA.gov, then prioritizes Santa Clara and
San Mateo counties. The registry has **22 sources and 46 starting pages**:
18 government source groups plus four providers referenced by official county
pages. Government coverage includes social services, health, energy assistance,
employment, disability, aging, veterans affairs, and court self-help. Provider
sources are Second Harvest of Silicon Valley, Sacred Heart Community Service,
Samaritan House, and Community Legal Services in East Palo Alto. Their registry
entries retain county referral URLs and limit crawling to assistance pages;
county government sources have priority over providers, then statewide sources.

Coverage includes housing, food, utilities, shelter, employment, legal help,
public benefits, family support, and health or disability services, including
the conditions in `Situation.conditions`. Discovery topic tags do not change
the app's `ResourceCategory` contract or establish program eligibility.

The crawler requires **Node.js 20.18.1 or newer** for its HTML parsing dependency.

Run a tiny check, inspect the available sources, or run the crawler tests:

```bash
npm run crawl:california -- --only=ca-gov-assistance --max-pages=1 --max-sitemaps=0
npm run crawl:california -- --list-sources
npm test -- scripts/crawler
npm run crawl:california -- --help
```

### Discovery and relevance

- Parses HTML with Cheerio, preferring main/article content and removing menus,
  scripts, cookie banners, and other repeated page elements from relevance text.
- Retains title, description, headings, readable text, source URL, discovery
  provenance, contacts, and links with their nearby text. Output is source
  evidence; it is **not yet normalized program `Resource` JSON**.
- Uses explainable rules, with no AI: an assistance topic must have practical
  help or a named program. Scores, matched terms, topic tags, and skip reasons
  are saved. Procurement, meetings, recruitment, and other administrative pages
  receive separate checks. An irrelevant page can still lead to a useful program.
- Prioritizes likely program links, removes tracking parameters, preserves
  meaningful query parameters, and suppresses repeated URLs and page content.
  Traversal stays within configured origins and path boundaries, including
  redirects. A limited sitemap search supplements links; it is not a site-wide scan.
- Keeps useful external provider/application links and PDFs as review leads.
  It does not automatically crawl unapproved providers, extract PDFs, or execute
  JavaScript-only applications. Source county labels are discovery hints, not
  proof of a program's service area.

### Budgets and repeat runs

Defaults are four workers, a one-second delay per origin, a 15-second request
deadline, two transient retries, and a two-megabyte response limit. Requests to
one origin are serialized; different origins can run concurrently. The crawler
checks `robots.txt`, honors longer crawl delays and `Retry-After`, and skips
origins when their robots policy cannot be read safely.

| Option | Purpose / default |
| --- | --- |
| `--only=id,id` | Select sources; CA.gov starts first unless excluded here |
| `--max-pages=N` | Override the **attempt** budget per source, including failures |
| `--max-total-pages=N` | Whole-run page attempt budget; 300 |
| `--max-requests=N` | Network request budget, including robots/retries; 1,200 |
| `--max-depth=N` / `--max-queue=N` | Link depth 4; pending URL limit 1,500 |
| `--max-sitemaps=N` | Sitemap requests per origin; 2, or 0 to disable |
| `--concurrency=N` / `--delay-ms=N` | Workers 4; minimum origin delay 1,000 ms |
| `--timeout-ms=N` / `--max-retries=N` | Request deadline 15,000 ms; retries 2 |
| `--output=path` | JSON output; `data/crawl-output/california-resource-pages.json` |
| `--cache-dir=path` / `--no-cache` | Cache location or disable cache; defaults beside output in `.cache` |

The cache uses ETag and Last-Modified validators when supplied by a server.
An HTTP 304 reuses stored HTML and reruns extraction, so changed relevance rules
still take effect. This saves downloads but still contacts the source.

The output includes kept pages, skipped pages, duplicates, leads, errors,
pending URLs, and coverage/network totals. Atomic checkpoints are written
during longer runs with `complete: false`; the final output has `complete: true`.
**Complete means the bounded run finished, not that every opportunity was found.**
Check pending URLs, errors, and truncation indicators before judging coverage.
Checkpoints preserve partial results; they are not automatic resume files.
Generated output and cache files are ignored by Git.

During source verification, Santa Clara government sites returned Cloudflare blocks,
DHCS returned challenge pages, CDPH had certificate-chain failures, and CalVet
reset connections. Availability can change; inspect each run's errors. The
crawler does not bypass site protections or disable certificate verification.
All four county-referenced providers served readable assistance pages with
robots checks during verification, adding local coverage when government pages
are unavailable. Provider referrals still require program-level review.

Implementation lives in `scripts/california-crawl-sources.mjs` (registry),
`scripts/crawl-california-resources.mjs` (CLI/output), and `scripts/crawler/`:
`engine.mjs` schedules discovery, `http.mjs` handles polite requests and robots,
`content.mjs` extracts/scores evidence, `urls.mjs` applies URL policy, and
`cache.mjs` stores conditional-cache entries and writes atomic JSON.

Review and normalize candidates before adding them to the live resource list.
The 211.org API remains a separate planned adapter; its HTML is not crawled.

### Normalizing candidates

After a crawl, run `npm run normalize:california`. This creates
`data/crawl-output/california-resource-candidates.json` with conservative draft
records. It maps topics to the current six `ResourceCategory` values, carries
source-area hints, application links, contacts, related program links, and
quoted page evidence, and leaves eligibility, active status, and unsupported
categories unknown. Every record is marked `needs_review`; the normalizer does
not publish candidates into the live resource list and does not use AI.
