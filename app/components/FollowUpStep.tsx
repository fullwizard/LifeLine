"use client";

import { useState } from "react";
import { formatMoney, type MessageKey } from "@/lib/i18n";
import type { AskableField, ResourceCategory, Situation } from "@/lib/types";
import type { ParseResponse } from "../actions";
import { useLanguage } from "./LanguageProvider";
import { PICKABLE_NEEDS } from "./SituationForm";

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
      ? t("fu.rationale", { n: q.expectedEliminations, total: parsed.candidateCount })
      : t("fu.rationale.fit");

  return (
    <div className="grid items-start gap-8 md:grid-cols-[1fr_1.65fr]">
      <UnderstoodFacts
        situation={parsed.situation}
        candidateCount={parsed.candidateCount}
        onNeedsChange={pending ? undefined : onNeedsChange}
      />

      <form
        className="rounded-none bg-paper p-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          onAnswer(value.trim() ? { field: q.field, value } : null);
        }}
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent-700">{t("fu.kicker")}</p>
          <label htmlFor="answer" className="mt-1 block text-lg font-medium">
            {t(`q.${q.field}` as MessageKey)}
          </label>
          <p className="mt-1 text-sm text-neutral-500">{rationale}</p>
        </div>

        {q.inputType === "select" && (
          <div className="grid gap-2">
            {q.options?.map((o) => (
              <label
                key={o.value}
                className={
                  "flex cursor-pointer items-start gap-3 rounded-none border px-3 py-2.5 text-sm transition " +
                  (value === o.value ? "border-accent-600 bg-accent-50" : "border-neutral-200 hover:border-neutral-300")
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
                  "rounded-none border px-5 py-2 text-sm font-medium transition " +
                  (value === o.v ? "border-accent-600 bg-accent-50 text-accent-900" : "border-neutral-200 bg-paper hover:border-neutral-300")
                }
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        {(q.inputType === "text" || q.inputType === "number") && (
          <div className="space-y-2">
            <input
              id="answer"
              type={q.inputType}
              inputMode={q.inputType === "number" ? "decimal" : undefined}
              min={q.inputType === "number" ? 0 : undefined}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (q.field === "location") setLocationStatus("idle");
              }}
              placeholder={q.field === "location" ? t("fu.placeholder.location") : q.field === "monthlyIncome" ? t("fu.placeholder.income") : ""}
              className="w-full rounded-none border border-neutral-300 px-3 py-2 text-base focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600"
            />
            {q.field === "location" && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={useBrowserLocation}
                  disabled={pending || locationStatus === "loading"}
                  className="text-sm font-medium text-accent-700 underline underline-offset-4 hover:text-accent-900 disabled:text-neutral-400"
                >
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

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="rounded-none bg-accent-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-800 disabled:bg-neutral-200 disabled:text-neutral-600"
          >
            {pending ? t("fu.building") : value.trim() ? t("fu.continue") : t("fu.skip")}
          </button>
          <button type="button" onClick={onBack} disabled={pending} className="text-sm text-neutral-500 hover:text-neutral-800">
            {t("fu.edit")}
          </button>
        </div>
      </form>
    </div>
  );
}

export function UnderstoodFacts({
  situation,
  candidateCount,
  onNeedsChange,
}: {
  situation: Situation;
  candidateCount?: number;
  /** When set, needs become toggles so the person can correct what we read. */
  onNeedsChange?: (needs: ResourceCategory[]) => void;
}) {
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

  const needs = situation.needs ?? [];
  const toggleable = Array.from(new Set([...needs, ...PICKABLE_NEEDS]));

  function toggle(need: ResourceCategory) {
    onNeedsChange?.(needs.includes(need) ? needs.filter((n) => n !== need) : [...needs, need]);
  }

  return (
    <section className="rounded-none bg-neutral-100 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-neutral-700">{t("facts.title")}</h2>
        {candidateCount !== undefined && <span className="text-xs text-neutral-500">{t("facts.count", { n: candidateCount })}</span>}
      </div>
      {chips.length || needs.length ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {chips.map((c) => (
            <li key={c} className="rounded-none bg-paper px-3 py-1 text-xs text-neutral-800">
              {c}
            </li>
          ))}
          {!onNeedsChange && needs.length > 0 && (
            <li className="rounded-none bg-paper px-3 py-1 text-xs text-neutral-800">
              {t("facts.needs")}: {needs.map((n) => t(`need.${n}` as MessageKey)).join(", ")}
            </li>
          )}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-neutral-500">{t("facts.none")}</p>
      )}
      {onNeedsChange && (
        <div className="mt-3">
          <p className="text-xs text-neutral-600">{t("facts.editHint")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {toggleable.map((need) => (
              <button
                key={need}
                type="button"
                aria-pressed={needs.includes(need)}
                onClick={() => toggle(need)}
                className="need-chip rounded-none border border-neutral-300 bg-paper px-2.5 py-1 text-xs font-medium text-neutral-800 transition hover:border-accent-600"
              >
                {t(`need.${need}` as MessageKey)}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
