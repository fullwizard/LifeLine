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
lib/data/               getResources() → mock fixtures today, Supabase later; AMI + place lookups
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

Sample resources are Seattle / King County, WA focused and approximate; treat
them as fixtures, not a verified directory.
