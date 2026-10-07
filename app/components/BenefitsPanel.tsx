"use client";

import { useState } from "react";
import type { BenefitEstimate, BenefitSummary } from "@/lib/benefits/estimate";
import { formatMoney, type MessageKey } from "@/lib/i18n";
import type { AskableField } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";
import { Badge, Button, ButtonLink, Card, SectionHeader } from "./ui";

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
    <section aria-labelledby="benefits-title">
      <SectionHeader title={<span id="benefits-title">{t("benefits.title")}</span>} description={t("benefits.sub")} />

      {monthlyTotal && (
        <Card className="mt-4 border-emerald-200 bg-emerald-50/60 p-5">
          <p className="text-2xl font-semibold tracking-tight text-emerald-900 tabular-nums sm:text-3xl">
            {monthlyTotal.low === monthlyTotal.high
              ? t("benefits.totalOne", { amount: formatMoney(monthlyTotal.high, lang) })
              : t("benefits.total", { low: formatMoney(monthlyTotal.low, lang), high: formatMoney(monthlyTotal.high, lang) })}
          </p>
          {estimates.length > 1 && <p className="mt-1 text-sm text-emerald-900/70">{t("benefits.plus")}</p>}
        </Card>
      )}

      {missing.length > 0 && <RefineForm missing={missing} pending={pending} onRefine={onRefine} />}

      {estimates.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-600">{t("benefits.none")}</p>
      ) : (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {estimates.map((e) => (
            <li key={e.id}>
              <BenefitCard estimate={e} titles={Object.fromEntries(estimates.map((x) => [x.id, x.title]))} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-neutral-400">{t("benefits.figures", { period: summary.figuresLabel })}</p>
    </section>
  );
}

function BenefitCard({ estimate: e, titles }: { estimate: BenefitEstimate; titles: Record<string, string> }) {
  const { t } = useLanguage();
  const unlocks = (e.unlocks ?? []).map((id) => titles[id]).filter(Boolean);
  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug text-neutral-900">{e.title}</h3>
        <Badge tone={e.status === "likely" ? "success" : "warning"}>{t(e.status === "likely" ? "benefits.likely" : "benefits.possible")}</Badge>
      </div>
      <p className="mt-2 text-base font-semibold text-neutral-900">{e.valueText}</p>
      <ul className="mt-2 space-y-1 text-sm leading-relaxed text-neutral-600">
        {e.why.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      {unlocks.length > 0 && <p className="mt-2 text-xs leading-relaxed text-neutral-500">{t("benefits.unlocks", { list: unlocks.join(", ") })}</p>}
      {e.assumptions.length > 0 && (
        <details className="mt-2 text-xs text-neutral-500">
          <summary className="font-medium text-neutral-600 hover:text-neutral-900">{t("benefits.assumptions")} ›</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {e.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <ButtonLink href={e.apply.url} external variant="primary" size="sm">
          {t("benefits.apply")} ↗
        </ButtonLink>
        {e.apply.phone && (
          <ButtonLink href={`tel:${e.apply.phone.replace(/[^0-9+]/g, "")}`} size="sm">
            {t("benefits.call", { phone: e.apply.phone })}
          </ButtonLink>
        )}
      </div>
    </Card>
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
      className="mt-4 rounded-lg border border-dashed border-neutral-300 p-4 no-print"
      onSubmit={(e) => {
        e.preventDefault();
        if (!filled.length || pending) return;
        onRefine(filled.map((m) => ({ field: FIELD_FOR[m], value: values[m]!.trim() })));
      }}
    >
      <p className="text-sm font-medium text-neutral-800">
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
              className="h-9 w-32 rounded-md border border-neutral-300 bg-paper px-2.5 text-base focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600/20"
            />
          </label>
        ))}
        <Button type="submit" variant="primary" size="sm" className="h-9" disabled={pending || !filled.length}>
          {pending ? t("fu.building") : t("benefits.addDetails")}
        </Button>
      </div>
    </form>
  );
}
