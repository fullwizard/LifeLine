"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { estimateBenefits } from "@/lib/benefits/estimate";
import { formatMoney, type MessageKey } from "@/lib/i18n";
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

const ResourceMap = dynamic(() => import("./ResourceMap").then((m) => m.ResourceMap), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-lg bg-neutral-100 sm:h-80" aria-hidden />,
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
  const shown = [...plan.ranked, ...plan.related];
  const checked = shown.filter((r) => r.resource.eligibility_verified).length;
  const confirmed = plan.ranked.filter((r) => !r.needsVerification).length;
  const todayCount = packet.steps.filter((s) => s.when === "now" || s.when === "today").length;
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
          {proseMatches && plan.summary && <p className="mt-3 text-sm leading-relaxed text-neutral-700">{plan.summary}</p>}
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <ReportDownloadButton plan={plan} benefits={benefits} packet={packet} />
          <Button variant="ghost" onClick={onReset}>
            {t("plan.edit")}
          </Button>
        </div>
      </header>

      {mappable && (
        <section aria-label={t("map.title")} className="no-print">
          <ResourceMap data={mapData} />
        </section>
      )}

      <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
        <Stat
          label={t("stat.benefits")}
          value={
            benefits.monthlyTotal
              ? benefits.monthlyTotal.low === benefits.monthlyTotal.high
                ? `${formatMoney(benefits.monthlyTotal.high, lang)}${t("stat.perMonth")}`
                : `${formatMoney(benefits.monthlyTotal.low, lang)}–${formatMoney(benefits.monthlyTotal.high, lang)}${t("stat.perMonth")}`
              : String(benefits.estimates.length)
          }
          hint={benefits.monthlyTotal ? t("stat.benefits.hint") : t("stat.benefits.count")}
          onClick={() => setTab("benefits")}
        />
        <Stat label={t("stat.today")} value={String(todayCount)} hint={t("stat.today.hint")} onClick={() => setTab("steps")} />
        <Stat
          label={t("stat.programs")}
          value={String(plan.ranked.length)}
          hint={t("stat.programs.hint", { checked, total: shown.length })}
          onClick={() => setTab("programs")}
        />
      </div>

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
              {x.count && <span className="rounded-full bg-neutral-100 px-1.5 text-xs text-neutral-600 tabular-nums">{x.count}</span>}
            </button>
          ))}
        </div>

        <div id="panel-steps" role="tabpanel" aria-labelledby="tab-steps" hidden={tab !== "steps"} className="print-show pt-6">
          <ReadyPacketView packet={packet} />
        </div>

        <div id="panel-benefits" role="tabpanel" aria-labelledby="tab-benefits" hidden={tab !== "benefits"} className="print-show pt-6">
          <BenefitsPanel summary={benefits} pending={pending} onRefine={onRefine} />
        </div>

        <div id="panel-programs" role="tabpanel" aria-labelledby="tab-programs" hidden={tab !== "programs"} className="print-show space-y-8 pt-6">
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-neutral-900">
                {plan.ranked.length === 1 ? t("plan.matching.one") : t("plan.matching", { n: plan.ranked.length })}
              </h2>
              <p className="text-xs text-neutral-500 tabular-nums">
                {t("plan.counts", { confirmed, unverified: plan.ranked.length - confirmed, excluded: plan.excludedCount })}
              </p>
            </div>
            <p className="mt-1 text-sm text-neutral-500">{t("trust.body", { checked, total: shown.length })}</p>
            {lang !== "en" && <p className="mt-1 text-xs text-neutral-500">{t("plan.englishNote")}</p>}
            <Legend />
            {plan.ranked.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">{t("plan.noMatch")}</p>
            ) : (
              <ol className="mt-4 space-y-3">
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
              <p className="mt-0.5 text-sm text-neutral-500">{t("plan.related.sub")}</p>
              <ol className="mt-4 space-y-3">
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

      <p className="border-t border-neutral-200 pt-4 text-xs leading-relaxed text-neutral-500">{t("plan.disclaimer")}</p>
    </div>
  );
}

function Stat({ label, value, hint, onClick }: { label: string; value: string; hint: string; onClick: () => void }) {
  // Phones: a compact row (label and hint left, value right). Wider screens: a tile.
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid grid-cols-[1fr_auto] items-center gap-x-4 rounded-lg border border-neutral-200 bg-paper px-4 py-3 text-left transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:grid-cols-1 sm:py-4"
    >
      <span className="col-start-1 row-start-1 text-xs font-medium text-neutral-500">{label}</span>
      <span className="col-start-2 row-span-2 row-start-1 text-xl font-semibold tracking-tight text-neutral-900 tabular-nums sm:col-start-1 sm:row-span-1 sm:row-start-2 sm:mt-1 sm:text-2xl">
        {value}
      </span>
      <span className="col-start-1 row-start-2 text-xs text-neutral-500 sm:row-start-3 sm:mt-0.5">{hint}</span>
    </button>
  );
}

function Legend() {
  const { t } = useLanguage();
  const items: [string, MessageKey][] = [
    ["bg-emerald-500", "legend.met"],
    ["bg-amber-500", "legend.unverified"],
    ["bg-neutral-300", "legend.unmet"],
  ];
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
      {items.map(([color, key]) => (
        <li key={key} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden /> {t(key)}
        </li>
      ))}
    </ul>
  );
}
