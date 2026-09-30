"use client";

import { useState } from "react";
import type { BenefitEstimate, BenefitSummary } from "@/lib/benefits/estimate";
import { formatMoney, type MessageKey } from "@/lib/i18n";
import type { AskableField } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";

type Missing = BenefitSummary["missing"][number];
const FIELD_FOR: Record<Missing, AskableField> = { income: "monthlyIncome", householdSize: "householdSize", rent: "monthlyHousingCost" };

export function BenefitsPanel({
  summary,
  pending,
  onRefine,
}: {
  summary: BenefitSummary;
  pending: boolean;
  onRefine: (answers: { field: AskableField; value: string }[]) => void;
}) {
  const { lang, t } = useLanguage();
  const { estimates, monthlyTotal, missing } = summary;

  return (
    <section id="benefits" aria-labelledby="benefits-title" className="scroll-mt-20 rounded-none bg-paper p-5 sm:p-7">
      <h2 id="benefits-title" className="text-xl font-semibold text-neutral-900">
        {t("benefits.title")}
      </h2>
      <p className="mt-1 text-sm text-neutral-600">{t("benefits.sub")}</p>

      {monthlyTotal && (
        <p className="mt-4 text-3xl font-semibold leading-tight text-emerald-800 sm:text-4xl">
          {monthlyTotal.low === monthlyTotal.high
            ? t("benefits.totalOne", { amount: formatMoney(monthlyTotal.high, lang) })
            : t("benefits.total", { low: formatMoney(monthlyTotal.low, lang), high: formatMoney(monthlyTotal.high, lang) })}
          {estimates.length > 1 && <span className="block text-base font-normal text-neutral-600">{t("benefits.plus")}</span>}
        </p>
      )}

      {missing.length > 0 && <RefineForm missing={missing} pending={pending} onRefine={onRefine} />}

      {estimates.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-600">{t("benefits.none")}</p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {estimates.map((e) => (
            <li key={e.id}>
              <BenefitCard estimate={e} titles={Object.fromEntries(estimates.map((x) => [x.id, x.title]))} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-neutral-500">{t("benefits.figures", { period: summary.figuresLabel })}</p>
    </section>
  );
}

function BenefitCard({ estimate: e, titles }: { estimate: BenefitEstimate; titles: Record<string, string> }) {
  const { t } = useLanguage();
  const unlocks = (e.unlocks ?? []).map((id) => titles[id]).filter(Boolean);
  return (
    <article className="flex h-full flex-col rounded-none border border-neutral-200 bg-neutral-50 p-4 break-inside-avoid">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug text-neutral-900">{e.title}</h3>
        <span
          className={
            "shrink-0 rounded-none px-2 py-0.5 text-xs font-medium " +
            (e.status === "likely" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900")
          }
        >
          {t(e.status === "likely" ? "benefits.likely" : "benefits.possible")}
        </span>
      </div>
      <p className="mt-1 text-lg font-semibold text-emerald-800">{e.valueText}</p>
      <ul className="mt-2 space-y-1 text-sm text-neutral-700">
        {e.why.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      {unlocks.length > 0 && <p className="mt-2 text-xs text-neutral-600">{t("benefits.unlocks", { list: unlocks.join(", ") })}</p>}
      {e.assumptions.length > 0 && (
        <details className="mt-2 text-xs text-neutral-600">
          <summary className="cursor-pointer font-medium text-neutral-700">{t("benefits.assumptions")}</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {e.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-3 text-sm">
        <a
          href={e.apply.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-none bg-accent-700 px-3 py-1.5 font-medium text-white hover:bg-accent-800"
        >
          {t("benefits.apply")}
        </a>
        {e.apply.phone && (
          <a
            href={`tel:${e.apply.phone.replace(/[^0-9+]/g, "")}`}
            className="rounded-none border border-neutral-300 bg-paper px-3 py-1.5 font-medium text-neutral-800 hover:bg-neutral-50"
          >
            {t("benefits.call", { phone: e.apply.phone })}
          </a>
        )}
      </div>
    </article>
  );
}

function RefineForm({
  missing,
  pending,
  onRefine,
}: {
  missing: Missing[];
  pending: boolean;
  onRefine: (answers: { field: AskableField; value: string }[]) => void;
}) {
  const { t } = useLanguage();
  const [values, setValues] = useState<Partial<Record<Missing, string>>>({});
  const items = missing.map((m) => t(`benefits.missing.${m}` as MessageKey));
  const filled = missing.filter((m) => values[m]?.trim());

  return (
    <form
      className="mt-4 rounded-none bg-accent-50 p-4 no-print"
      onSubmit={(e) => {
        e.preventDefault();
        if (!filled.length || pending) return;
        onRefine(filled.map((m) => ({ field: FIELD_FOR[m], value: values[m]!.trim() })));
      }}
    >
      <p className="text-sm font-medium text-accent-950">
        {t("benefits.missing", { items: items.join(t("benefits.missing.and")) })}
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        {missing.map((m) => (
          <label key={m} className="flex flex-col text-xs text-neutral-700">
            <span className="mb-1">{t(`benefits.missing.${m}` as MessageKey)}</span>
            <input
              type="number"
              inputMode="decimal"
              min={m === "householdSize" ? 1 : 0}
              value={values[m] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [m]: e.target.value }))}
              placeholder={m === "householdSize" ? "3" : m === "rent" ? "2200" : "2400"}
              className="w-32 rounded-none border border-neutral-300 px-2.5 py-1.5 text-base focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600"
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={pending || !filled.length}
          className="rounded-none bg-accent-700 px-4 py-2 text-sm font-medium text-white hover:bg-accent-800 disabled:bg-neutral-200 disabled:text-neutral-600"
        >
          {pending ? t("fu.building") : t("benefits.addDetails")}
        </button>
      </div>
    </form>
  );
}
