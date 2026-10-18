# LifeLine

An MVP web app that helps people in a hard spot get a prioritized, explained
plan of assistance programs: housing, food, utilities, legal help, health care,
benefits, and support for families, veterans, and older adults. Programs are
mostly local (Santa Clara and San Mateo counties, and California), with a small
national tier of federal agencies.

Describe your situation in plain language → answer a few focused follow-up
questions → get a ranked list of resources, each with a structured "why"
breakdown that separates **confirmed** facts from eligibility that still
**needs verification** with the organization.

Each plan also comes with estimated benefits, a "get ready" packet (ordered
steps, one document checklist, what to say when you call), a service-area map,
and a `report.pdf` the person can download, print, or send to themselves. See
[The plan page](#the-plan-page).

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest: matching, follow-up, benefits, i18n, packet, map, share links, report.pdf, crawler + data scripts
npm run typecheck
npm run lint
```

No API key or database is needed. Copy `.env.example` to `.env.local` and set
`GEMINI_API_KEY` to have Gemini parse free text and write the plan prose; with
it unset, a keyword parser and template explainer do the same job offline.

Built with Next.js 16 (App Router), React 19, Tailwind 4, Leaflet, and
`@react-pdf/renderer`; tests use Vitest. This Next.js version differs from older
ones: `AGENTS.md` points to the docs that ship in `node_modules/next/dist/docs/`.

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
lib/data/               getResources() → data/resources.json today, Supabase later; AMI + place lookups
lib/gemini/             Parser + explainer interfaces; Gemini impls with deterministic fallbacks
lib/plan/buildPlan.ts   The only place the layers are wired together
lib/plan/readyPacket.ts "Get ready" packet: ordered steps, one merged document checklist, call scripts, share text
lib/benefits/           Benefit estimator (CalFresh $, CARE/FERA, Medi-Cal, WIC, school meals, CalEITC) + dated figures
lib/map/                planMapData(): a plan → county shading + one dot per program. Pure: no Leaflet or React
lib/safety/, safety.ts  Deterministic crisis-language screening (no AI); shows 988 support before continuing
lib/share/              sms:/mailto: link builders for "Text it to myself" and "Email it to myself"
lib/i18n/               English, Spanish, Vietnamese, Simplified and Traditional Chinese; missing keys fall back to English
app/                    Next.js App Router UI (server actions in app/actions.ts)
  components/report/      report.pdf document (react-pdf) and the browser download/print helpers
  components/useReport.ts One report shared by the Download and Print buttons
data/                   resources.json (what the app loads), reviewed/ overrides, geo/ county outlines, crawl-output/
scripts/                Crawler, normalizer, and promote scripts (see Data pipeline)
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

### Benefit estimates

`lib/benefits/estimate.ts` applies each program's published rules to what the
person told us. CalFresh uses the standard formula (gross − 20% of earnings −
standard deduction − excess shelter, then max allotment − 30% of net) with
California's 200% FPL gross test. Unknown facts widen the range or downgrade
the result to "possible"; every estimate lists its assumptions.
`lib/benefits/figures.ts` holds dated figure sets and switches on October 1.
**Add next year's block each August** when USDA publishes the SNAP COLA memo.

### The plan page

- **Get ready packet** (`lib/plan/readyPacket.ts`, `ReadyPacketView.tsx`): steps
  ordered by urgency, one merged document checklist, and a call script for each
  top program (what to say, what to ask). It is computed in the browser from the
  plan, so switching language re-renders it instantly.
- **Map** (`lib/map/planMapData.ts`, `ResourceMap.tsx`; Leaflet with
  OpenStreetMap tiles, county outlines in `data/geo/`): the counties a program
  serves are shaded and each program gets one dot. A program with a published
  street address is an exact pin; a county-level program is placed inside its
  county and labelled approximate; statewide and national programs are clustered
  near the person and labelled as available anywhere.
- **report.pdf** (`app/components/report/ReportDocument.tsx`): the plan as a
  Letter-size PDF with benefits, ordered steps, the document checklist, call
  scripts, and every matching and related program. It is rendered in the
  browser with `@react-pdf/renderer`, loaded only when someone asks for it, so
  the plan is not sent anywhere to make it. Latin-script languages use Noto Sans
  from `public/fonts/` (SIL OFL); the Simplified and Traditional Chinese fonts
  (5–8 MB each) are fetched from jsDelivr only when one of those languages is
  selected.
- **Print is report.pdf.** The Print and Download buttons render the same
  document through one `useReport` hook, so what prints is what downloads.
  Desktop browsers that report a built-in PDF viewer, except Safari, print it from
  a hidden frame (tested in Chrome only); phones and Safari open the PDF in a new
  tab to print or share from the viewer. If the PDF
  cannot be built (for example offline, before the Chinese fonts load), Print
  falls back to printing the page itself with the print rules at the bottom of
  `app/globals.css`. The browser's own File → Print or Cmd+P still prints the
  page, not the PDF.
- **Send it to yourself.** "Text it to myself" and "Email it to myself" are
  `sms:` and `mailto:` links built by `lib/share/shareLinks.ts` that open the
  person's own Messages or Mail app with the plan text; nothing passes through
  LifeLine. On Windows only, the mailto link is cut to 1,900 characters at a
  whole line, with a "shortened" note, because Outlook and the Windows launcher
  are documented to refuse links near 2,000 characters (this limit has not been
  tested on a Windows machine). If a click opens no app within 1.5 seconds, as on
  a shared computer with no mail program, a hint points to Copy.

### What leaves the browser

- The description the person types goes to the server action in
  `app/actions.ts` to be parsed and matched, and to Gemini only when
  `GEMINI_API_KEY` is set. LifeLine has no database and does not store it. The
  chosen language is kept in the browser's `localStorage` and never sent anywhere.
- report.pdf, Print, and the share links are built in the browser; the plan is
  not sent to LifeLine's server for them.
- Third-party requests the page makes: OpenStreetMap map tiles and, for Chinese
  report.pdf files only, the fonts from jsDelivr.

### Languages

The UI, benefit text, packet, and report.pdf are translated into English,
Spanish, Vietnamese, Simplified Chinese (`zh-Hans`), and Traditional Chinese
(`zh-Hant`) in `lib/i18n/messages/*.ts`; `npm test` fails if any language is
missing a key or placeholder. Browser language tags map to the nearest one
(`zh-CN` to Simplified; `zh-TW` and `zh-HK` to Traditional). The keyword parser
rewrites everyday Spanish into phrasings its English rules understand
(`lib/gemini/fallback/spanish.ts`); with `GEMINI_API_KEY` set, any language works.
Program descriptions and eligibility details come from English sources.

## Data pipeline

```
npm run crawl:california      # scripts/crawl-california-resources.mjs → data/crawl-output/california-resource-pages.json (raw, gitignored)
npm run normalize:california  # → data/crawl-output/california-resource-candidates.json (deduped, eligibility extracted, unverified; committed)
# review: edit data/reviewed/eligibility-overrides.json for records you have checked against the source
npm run promote:resources     # candidates + overrides + previous output → data/resources.json (the ONLY file the app loads)
```

The national tier (federal agencies, `service_area: US`) goes through the same
steps into its own files:

```
npm run crawl:california -- --only=usa-gov-federal-benefits --output=data/crawl-output/federal-resource-pages.json
npm run normalize:california -- --input=data/crawl-output/federal-resource-pages.json --output=data/crawl-output/federal-resource-candidates.json
npm run promote:resources     # reads both candidate files; one that does not exist is skipped with a note
```

A crawl without `--only` runs every registered source, federal included, so use
`--only` to keep the two apart. If an id appears in both candidate files, the
first (California) wins.

- `data/resources.json` is committed and must be regenerated after a crawl or a
  review. Promotion fails loudly on any malformed record, so a bad crawl can
  never reach the app.
- Promotion reads the previous `data/resources.json` (`--previous=path` to use
  another file) so a re-crawl cannot lose review work. Ids can change between
  crawls: an override whose id changed is re-keyed through the previous record's
  `source_url`, with a warning naming the new id. A verified record whose page
  the latest crawl missed is kept, flagged `carried_forward`, and listed for
  re-check. Records excluded by review stay excluded.
- `extractEligibility()` in the normalizer captures rules the page states in
  recognisable words (AMI %, FPL %, annual caps, veteran/children requirements,
  housing status, CalWORKs/APS prerequisites, residency, ZIP lists). Everything
  it produces is `eligibility_verified: false` and shown as "needs verification".
- An override in `eligibility-overrides.json` replaces the record's eligibility
  wholesale, marks it verified, and can also fix `active`, `phone` (`""`
  removes a wrong number), `required_documents`, `response_time_days`,
  `description`, `application_url`, and `source_url`. `exclude: true` (with an
  `exclude_reason`) drops a dead page or non-program. Only add what you have
  read on the source page.
- `lib/data/ami.ts` holds HUD FY2026 Area Median Income by county. Refresh it
  each spring.

## Swapping in real services

- **Supabase:** replace the body of `getResources()` in `lib/data/resources.ts`.
- **AMI data:** replace `lib/data/ami.ts` with a HUD income-limits lookup.
- **Geocoding:** replace `resolvePlace()` in `lib/data/places.ts`.

The dataset is California focused, plus a small national tier of federal
agencies, and review-first; treat it as fixtures, not a verified directory.

## California resource crawler

`npm run crawl:california` collects public assistance information into a local
JSON review queue. It starts with CA.gov, then prioritizes Santa Clara and
San Mateo counties. The registry has **24 sources and 64 starting pages**:
23 California sources (47 pages), made up of 19 government source groups plus
four providers referenced by official county pages, and one federal source
(17 pages, see [Federal agencies](#federal-agencies-national-tier)).
Government coverage includes social services, health, energy assistance,
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
Raw crawl output and cache files are ignored by Git; the two normalized
candidate files (California and federal) are committed.

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

### Federal agencies (national tier)

`usa-gov-federal-benefits` (`FEDERAL_CRAWL_SOURCES` in
`scripts/california-crawl-sources.mjs`, service area `US`) crawls an allowlist of
17 USA.gov agency pages for the agencies that run benefits people apply for:
Social Security; Veterans Affairs (VA, VBA, VHA, and VETS); HUD (HUD, Public and
Indian Housing, and Fair Housing); ACF; ACL; CMS; Indian Health Service; the Food
and Nutrition Administration; Legal Services Corporation; IRS; ETA; and SAMHSA.
The directory lists 400+ agencies; only these exact pages are in scope
(`USA_GOV_FEDERAL_AGENCIES`), each mapped to a `ResourceCategory` by hand.
USA.gov's `robots.txt` asks for a 10-second crawl delay and the engine honors
it, so 17 pages take roughly three minutes at minimum.

Agency pages describe who an agency serves in general, so the normalizer applies
the source's own settings by id: the hand-picked category wins over the name
heuristics, the agency name comes from the page title, and eligibility
extraction is skipped so copy like "low-income" is not read as applicant rules.
The relevance check dropped the Fair Housing page as not actionable, so the
committed federal candidates have 16 records.

### Normalizing candidates

After a crawl, run `npm run normalize:california` (`--input=path` and
`--output=path` choose other files). This creates
`data/crawl-output/california-resource-candidates.json` with conservative draft
records. It maps topics to the `ResourceCategory` values in `lib/types.ts`, carries
source-area hints, application links, contacts, related program links, and
quoted page evidence, and leaves eligibility, active status, and unsupported
categories unknown. Every record is marked `needs_review`; the normalizer does
not publish candidates into the live resource list and does not use AI.
