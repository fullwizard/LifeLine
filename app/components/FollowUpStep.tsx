"use client";

import { useState } from "react";
import { formatMoney, type MessageKey } from "@/lib/i18n";
import { RESOURCE_CATEGORIES, type AskableField, type ResourceCategory, type Situation } from "@/lib/types";
import type { ParseResponse } from "../actions";
import { useLanguage } from "./LanguageProvider";
import { PICKABLE_NEEDS } from "./SituationForm";
import { Button, Card, Spinner } from "./ui";

export function FollowUpStep({
  parsed,
  pending,
  onAnswer,
  onNeedsChange,
  onBack,
}: {
  parsed: ParseResponse;
  pending: boolean;
  onAnswer: (answer: { field: AskableField; value: string } | null) => void;
  onNeedsChange: (needs: ResourceCategory[]) => void;
  onBack: () => void;
}) {
  const { t } = useLanguage();
  const q = parsed.question!;
  const [value, setValue] = useState("");
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "error">("idle");

  function useBrowserLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      return;
    }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const answer = `Current location (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`;
        setValue(answer);
        setLocationStatus("idle");
        // A successful location lookup is already an answer. Continue the
        // follow-up flow immediately instead of making the user press again.
        onAnswer({ field: q.field, value: answer });
      },
      () => setLocationStatus("error"),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  }

  const rationale =
    q.expectedEliminations > 0
      ? t("fu.rationale", { n: Math.max(1, Math.round(q.expectedEliminations)), total: parsed.candidateCount })
      : t("fu.rationale.fit");

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          onAnswer(value.trim() ? { field: q.field, value } : null);
        }}
      >
        <Card className="shadow-sm">
          <div className="space-y-5 p-5 sm:p-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t("fu.kicker")}</p>
              <label htmlFor="answer" className="mt-1.5 block text-xl font-semibold tracking-tight text-neutral-900">
                {t(`q.${q.field}` as MessageKey)}
              </label>
              <p className="mt-1.5 text-sm text-neutral-500">{rationale}</p>
            </div>

            {q.inputType === "select" && (
              <div className="grid gap-2" role="radiogroup">
                {q.options?.map((o) => (
                  <label
                    key={o.value}
                    className={
                      "flex cursor-pointer items-start gap-3 rounded-md border px-3.5 py-3 text-sm transition-colors " +
                      (value === o.value ? "border-accent-700 bg-accent-50 text-neutral-900" : "border-neutral-200 text-neutral-700 hover:border-neutral-300")
                    }
                  >
                    <input
                      type="radio"
                      name="answer"
                      value={o.value}
                      checked={value === o.value}
                      onChange={() => setValue(o.value)}
                      className="mt-0.5 accent-accent-700"
                    />
                    <span>{q.field === "housingStatus" ? t(`hs.option.${o.value}` as MessageKey) : o.label}</span>
                  </label>
                ))}
              </div>
            )}

            {q.inputType === "boolean" && (
              <div className="flex gap-2">
                {[
                  { v: "true", label: t("fu.yes") },
                  { v: "false", label: t("fu.no") },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setValue(o.v)}
                    aria-pressed={value === o.v}
                    className={
                      "h-10 min-w-24 rounded-md border px-5 text-sm font-medium transition-colors " +
                      (value === o.v ? "border-accent-700 bg-accent-50 text-accent-800" : "border-neutral-300 bg-paper text-neutral-800 hover:bg-neutral-50")
                    }
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}

            {(q.inputType === "text" || q.inputType === "number") && (
              <div className="space-y-2">
                <div className="relative max-w-sm">
                  {q.field === "monthlyIncome" && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">$</span>}
                  <input
                    id="answer"
                    type={q.inputType}
                    inputMode={q.inputType === "number" ? "decimal" : undefined}
                    min={q.inputType === "number" ? 0 : undefined}
                    value={value}
                    autoFocus
                    onChange={(e) => {
                      setValue(e.target.value);
                      if (q.field === "location") setLocationStatus("idle");
                    }}
                    placeholder={q.field === "location" ? t("fu.placeholder.location") : q.field === "monthlyIncome" ? t("fu.placeholder.income") : ""}
                    className={
                      "h-10 w-full rounded-md border border-neutral-300 bg-paper px-3 text-base focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600/20 " +
                      (q.field === "monthlyIncome" ? "pl-7" : "")
                    }
                  />
                </div>
                {q.field === "location" && (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={useBrowserLocation}
                      disabled={pending || locationStatus === "loading"}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-700 hover:text-accent-800 disabled:text-neutral-400"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11Z" />
                        <circle cx="12" cy="10" r="2.5" />
                      </svg>
                      {locationStatus === "loading" ? t("fu.locating") : t("fu.useLocation")}
                    </button>
                    {locationStatus === "error" && (
                      <span className="text-sm text-neutral-500" role="status">
                        {t("fu.locationError")}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-lg border-t border-neutral-200 bg-neutral-50 px-5 py-4 sm:px-6">
            <Button variant="ghost" onClick={onBack} disabled={pending}>
              ← {t("fu.edit")}
            </Button>
            <Button type="submit" variant={value.trim() ? "primary" : "secondary"} disabled={pending}>
              {pending && <Spinner />}
              {pending ? t("fu.building") : value.trim() ? t("fu.continue") : t("fu.skip")}
            </Button>
          </div>
        </Card>
      </form>

      <UnderstoodFacts situation={parsed.situation} candidateCount={parsed.candidateCount} onNeedsChange={onNeedsChange} />
    </div>
  );
}

/** Short labels for what we read from the person's words. */
export function useFactChips(situation: Situation): string[] {
  const { lang, t } = useLanguage();
  const chips: string[] = [];
  const loc = situation.location;
  if (loc) {
    const label = [loc.city, loc.county].filter(Boolean).join(", ") || (loc.zip ? t("facts.zip", { zip: loc.zip }) : undefined);
    chips.push(label ?? (loc.lat !== undefined && loc.lng !== undefined ? t("facts.currentLocation") : t("facts.locationProvided")));
  }
  if (situation.housingStatus) chips.push(t(`status.${situation.housingStatus}` as MessageKey));
  if (situation.householdSize) chips.push(t("facts.household", { n: situation.householdSize }));
  if (situation.monthlyIncome !== undefined) chips.push(t("facts.income", { amount: formatMoney(situation.monthlyIncome, lang) }));
  if (situation.monthlyHousingCost !== undefined) chips.push(t("facts.rent", { amount: formatMoney(situation.monthlyHousingCost, lang) }));
  if (situation.hasChildren === true) chips.push(t("facts.kids"));
  if (situation.hasChildren === false) chips.push(t("facts.noKids"));
  if (situation.isPregnant) chips.push(t("facts.pregnant"));
  if (situation.age !== undefined) chips.push(t("facts.age", { n: situation.age }));
  if (situation.isVeteran === true) chips.push(t("facts.veteran"));
  if (situation.isVeteran === false) chips.push(t("facts.notVeteran"));
  return chips;
}

export function UnderstoodFacts({
  situation,
  candidateCount,
  onNeedsChange,
}: {
  situation: Situation;
  candidateCount?: number;
  onNeedsChange: (needs: ResourceCategory[]) => void;
}) {
  const { t } = useLanguage();
  const chips = useFactChips(situation);
  const needs = situation.needs ?? [];
  // A fixed order that never reshuffles on tap: the common needs plus any
  // others we read from the person's words, in the canonical category order.
  const [detected] = useState(() => new Set(needs));
  const options = RESOURCE_CATEGORIES.filter((c) => PICKABLE_NEEDS.includes(c) || detected.has(c) || needs.includes(c));

  function toggle(need: ResourceCategory) {
    onNeedsChange(needs.includes(need) ? needs.filter((n) => n !== need) : [...needs, need]);
  }

  return (
    <Card className="lg:sticky lg:top-6">
      <div className="border-b border-neutral-200 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">{t("facts.title")}</h2>
          {candidateCount !== undefined && (
            <span className="text-xs text-neutral-500 tabular-nums" aria-live="polite">
              {t("facts.count", { n: candidateCount })}
            </span>
          )}
        </div>
        {chips.length ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <li key={c} className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                {c}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">{t("facts.none")}</p>
        )}
      </div>
      <div className="px-4 py-3">
        <p className="text-xs font-medium text-neutral-700">{t("facts.needs")}</p>
        <p className="mt-0.5 text-xs text-neutral-500">{t("facts.editHint")}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {options.map((need) => (
            <button key={need} type="button" className="chip" aria-pressed={needs.includes(need)} onClick={() => toggle(need)}>
              {t(`need.${need}` as MessageKey)}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
