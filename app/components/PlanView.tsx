"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { estimateBenefits } from "@/lib/benefits/estimate";
import { buildPlanMapData } from "@/lib/map/planMapData";
import { buildReadyPacket } from "@/lib/plan/readyPacket";
import type { AskableField, Plan } from "@/lib/types";
import { BenefitsPanel } from "./BenefitsPanel";
import { useFactChips } from "./FollowUpStep";
import { useLanguage } from "./LanguageProvider";
import { ReadyPacketView } from "./ReadyPacketView";
import { ReportDownloadButton } from "./ReportDownloadButton";
import { ResourceCard } from "./ResourceCard";
import { Button } from "./ui";
import { useReport } from "./useReport";

const ResourceMap = dynamic(() => import("./ResourceMap").then((m) => m.ResourceMap), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse bg-neutral-100 sm:h-80" aria-hidden />,
});

type Tab = "steps" | "benefits" | "programs";

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
  const [tab, setTab] = useState<Tab>("steps");
  const facts = useFactChips(plan.situation);
  const mapData = useMemo(() => buildPlanMapData(plan.ranked, plan.related, plan.situation), [plan]);
  const mappable = mapData.areas.length > 0 || mapData.dots.length > 0;
  // Pure and fast: recomputed on the client so a language switch re-renders instantly.
  const benefits = useMemo(() => estimateBenefits(plan.situation, t, lang), [plan, t, lang]);
  const packet = useMemo(() => buildReadyPacket(plan, benefits, t, lang), [plan, benefits, t, lang]);
  // Download and Print share this, so both produce the same report.pdf.
  const report = useReport({ plan, benefits, packet, facts });
  const shown = [...plan.ranked, ...plan.related];
  // Summary and notes were written in the language chosen when the plan was built.
  const proseMatches = plan.lang === lang;
  // Template notes repeat the breakdown shown under "Show why"; only AI-written notes add something.
  const noteFor = (id: string) => (proseMatches && plan.generatedBy === "gemini" ? plan.resourceNotes[id] : undefined);

  // Map popups link to "#resource-<id>": open the Programs tab, then scroll to the card.
  useEffect(() => {
    function onHash() {
      const id = window.location.hash.slice(1);
      if (!id.startsWith("resource-")) return;
      setTab("programs");
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const tabs: { id: Tab; label: string; count?: string }[] = [
    { id: "steps", label: t("tab.steps") },
    { id: "benefits", label: t("tab.benefits"), count: benefits.estimates.length ? String(benefits.estimates.length) : undefined },
    { id: "programs", label: t("tab.programs"), count: String(shown.length) },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">{t("plan.title")}</h1>
          {facts.length > 0 && (
            <p className="mt-2 text-sm text-neutral-600">
              {facts.map((f, i) => (
                <span key={f}>
                  {i > 0 && <span className="mx-1.5 text-neutral-300">·</span>}
                  {f}
                </span>
              ))}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <ReportDownloadButton report={report} />
          <Button variant="ghost" onClick={onReset}>
            {t("plan.edit")}
          </Button>
        </div>
      </header>

      {mappable && (
        <section aria-label={t("map.title")} className="space-y-2 no-print">
          <h2 className="text-sm font-semibold text-neutral-700">{t("map.title")}</h2>
          <ResourceMap data={mapData} />
        </section>
      )}

      <div>
        <div role="tablist" aria-label={t("plan.title")} className="flex gap-1 overflow-x-auto border-b border-neutral-200 no-print">
          {tabs.map((x) => (
            <button
              key={x.id}
              role="tab"
              id={`tab-${x.id}`}
              aria-selected={tab === x.id}
              aria-controls={`panel-${x.id}`}
              onClick={() => setTab(x.id)}
              className={
                "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors " +
                (tab === x.id ? "border-accent-700 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800")
              }
            >
              {x.label}
              {x.count && <span className="bg-signal-soft px-1.5 text-xs text-neutral-800 tabular-nums">{x.count}</span>}
            </button>
          ))}
        </div>

        <div id="panel-steps" role="tabpanel" aria-labelledby="tab-steps" hidden={tab !== "steps"} className="print-show pt-6">
          <ReadyPacketView packet={packet} onPrint={report.print} printing={report.state === "working"} />
        </div>

        <div id="panel-benefits" role="tabpanel" aria-labelledby="tab-benefits" hidden={tab !== "benefits"} className="print-show pt-6">
          <BenefitsPanel summary={benefits} pending={pending} onRefine={onRefine} />
        </div>

        <div id="panel-programs" role="tabpanel" aria-labelledby="tab-programs" hidden={tab !== "programs"} className="print-show space-y-8 pt-6">
          <section>
            <h2 className="text-base font-semibold text-neutral-900">
              {plan.ranked.length === 1 ? t("plan.matching.one") : t("plan.matching", { n: plan.ranked.length })}
            </h2>
            {lang !== "en" && <p className="mt-1 text-xs text-neutral-500">{t("plan.englishNote")}</p>}
            {plan.ranked.length === 0 ? (
              <p className="mt-4 border-l-4 border-signal bg-neutral-50 p-5 text-sm text-neutral-700">{t("plan.noMatch")}</p>
            ) : (
              <ol className="mt-4 border-t border-neutral-300">
                {plan.ranked.map((r, i) => (
                  <li key={r.resource.id}>
                    <ResourceCard rank={i + 1} scored={r} note={noteFor(r.resource.id)} />
                  </li>
                ))}
              </ol>
            )}
          </section>

          {plan.related.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-neutral-900">{t("plan.related.title")}</h2>
              <ol className="mt-4 border-t border-neutral-300">
                {plan.related.map((r, i) => (
                  <li key={r.resource.id}>
                    <ResourceCard
                      rank={plan.ranked.length + i + 1}
                      scored={r}
                      note={noteFor(r.resource.id)}
                    />
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
