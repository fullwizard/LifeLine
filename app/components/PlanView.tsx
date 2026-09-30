"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { estimateBenefits } from "@/lib/benefits/estimate";
import { buildPlanMapData } from "@/lib/map/planMapData";
import { buildReadyPacket } from "@/lib/plan/readyPacket";
import type { AskableField, Plan } from "@/lib/types";
import { BenefitsPanel } from "./BenefitsPanel";
import { UnderstoodFacts } from "./FollowUpStep";
import { useLanguage } from "./LanguageProvider";
import { ReadyPacketView } from "./ReadyPacketView";
import { ResourceCard } from "./ResourceCard";

const ResourceMap = dynamic(() => import("./ResourceMap").then((m) => m.ResourceMap), {
  ssr: false,
  loading: () => <div className="h-[380px] w-full animate-pulse rounded-none bg-neutral-50" aria-hidden />,
});

export function PlanView({
  plan,
  pending,
  onRefine,
  onReset,
}: {
  plan: Plan;
  pending: boolean;
  onRefine: (answers: { field: AskableField; value: string }[]) => void;
  onReset: () => void;
}) {
  const { lang, t } = useLanguage();
  const confirmed = plan.ranked.filter((r) => !r.needsVerification).length;
  const [showMap, setShowMap] = useState(true);
  const mapData = useMemo(() => buildPlanMapData(plan.ranked, plan.related, plan.situation), [plan]);
  const mappable = mapData.areas.length > 0 || mapData.pins.length > 0;
  // Pure and fast: recomputed on the client so a language switch re-renders instantly.
  const benefits = useMemo(() => estimateBenefits(plan.situation, t, lang), [plan, t, lang]);
  const packet = useMemo(() => buildReadyPacket(plan, benefits, t, lang), [plan, benefits, t, lang]);
  const shown = [...plan.ranked, ...plan.related];
  const checked = shown.filter((r) => r.resource.eligibility_verified).length;
  // Summary and steps were written in the language chosen when the plan was built.
  const proseMatches = plan.lang === lang;

  return (
    <div className="space-y-6">
      <UnderstoodFacts situation={plan.situation} />

      <nav aria-label={t("plan.title")} className="sticky top-0 z-10 -mx-1 flex gap-1 bg-paper/95 px-1 py-2 backdrop-blur no-print">
        {[
          { href: "#benefits", label: t("nav.benefits") },
          { href: "#ready", label: t("nav.ready") },
          { href: "#programs", label: t("nav.programs") },
        ].map((l) => (
          <a key={l.href} href={l.href} className="rounded-none bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-200">
            {l.label}
          </a>
        ))}
      </nav>

      {proseMatches && (
        <section className="rounded-none bg-accent-50 p-5">
          <h2 className="text-lg font-semibold text-accent-950">{t("plan.title")}</h2>
          <p className="mt-2 text-neutral-800 leading-relaxed">{plan.summary}</p>
        </section>
      )}

      <BenefitsPanel summary={benefits} pending={pending} onRefine={onRefine} />

      <ReadyPacketView packet={packet} />

      <section id="programs" className="scroll-mt-20">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {plan.ranked.length === 1 ? t("plan.matching.one") : t("plan.matching", { n: plan.ranked.length })}
          </h2>
          <p className="text-xs text-neutral-500">
            {t("plan.counts", { confirmed, unverified: plan.ranked.length - confirmed, excluded: plan.excludedCount })}
          </p>
        </div>
        {shown.length > 0 && (
          <p className="mt-2 text-sm text-neutral-700">
            <span className="font-medium">{t("trust.title")}: </span>
            {t("trust.body", { checked, total: shown.length })}
          </p>
        )}
        {lang !== "en" && <p className="mt-1 text-xs text-neutral-500">{t("plan.englishNote")}</p>}
        <Legend />
        {mappable && (
          <div className="mt-4 no-print">
            <button
              type="button"
              onClick={() => setShowMap((v) => !v)}
              aria-expanded={showMap}
              className="text-sm font-medium text-accent-700 underline-offset-4 hover:underline"
            >
              {showMap ? t("map.hide") : t("map.show")}
            </button>
            {showMap && (
              <div className="mt-3">
                <ResourceMap data={mapData} />
              </div>
            )}
          </div>
        )}
        {plan.ranked.length === 0 ? (
          <p className="mt-4 rounded-none bg-paper p-4 text-sm text-neutral-600">{t("plan.noMatch")}</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {plan.ranked.map((r, i) => (
              <li key={r.resource.id}>
                <ResourceCard rank={i + 1} scored={r} note={proseMatches ? plan.resourceNotes[r.resource.id] : undefined} />
              </li>
            ))}
          </ol>
        )}
      </section>

      {plan.related.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">{t("plan.related.title")}</h2>
          <p className="text-xs text-neutral-500">{t("plan.related.sub")}</p>
          <ol className="mt-4 space-y-4">
            {plan.related.map((r, i) => (
              <li key={r.resource.id}>
                <ResourceCard
                  rank={plan.ranked.length + i + 1}
                  scored={r}
                  note={proseMatches ? plan.resourceNotes[r.resource.id] : undefined}
                />
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="rounded-none bg-amber-50 px-4 py-3 text-xs text-amber-900 leading-relaxed">{t("plan.disclaimer")}</p>

      <button type="button" onClick={onReset} className="text-sm font-medium text-accent-700 hover:text-accent-900">
        {t("plan.startOver")}
      </button>
    </div>
  );
}

function Legend() {
  const { t } = useLanguage();
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden /> {t("legend.met")}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden /> {t("legend.unverified")}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-400" aria-hidden /> {t("legend.unmet")}
      </li>
    </ul>
  );
}
