"use client";

import { useState } from "react";
import type { AskableField, Situation } from "@/lib/types";
import type { ParseResponse } from "../actions";

export function FollowUpStep({
  parsed,
  pending,
  onAnswer,
  onBack,
}: {
  parsed: ParseResponse;
  pending: boolean;
  onAnswer: (answer: { field: AskableField; value: string } | null) => void;
  onBack: () => void;
}) {
  const q = parsed.question!;
  const [value, setValue] = useState("");

  return (
    <div className="space-y-6">
      <UnderstoodFacts situation={parsed.situation} candidateCount={parsed.candidateCount} parsedBy={parsed.parsedBy} />

      <form
        className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          onAnswer(value.trim() ? { field: q.field, value } : null);
        }}
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700">One quick question</p>
          <label htmlFor="answer" className="mt-1 block text-lg font-medium">
            {q.prompt}
          </label>
          <p className="mt-1 text-sm text-stone-500">{q.rationale}</p>
        </div>

        {q.inputType === "select" && (
          <div className="grid gap-2">
            {q.options?.map((o) => (
              <label
                key={o.value}
                className={
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition " +
                  (value === o.value ? "border-teal-600 bg-teal-50" : "border-stone-200 hover:border-stone-300")
                }
              >
                <input
                  type="radio"
                  name="answer"
                  value={o.value}
                  checked={value === o.value}
                  onChange={() => setValue(o.value)}
                  className="mt-0.5 accent-teal-700"
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        )}

        {q.inputType === "boolean" && (
          <div className="flex gap-2">
            {[
              { v: "true", label: "Yes" },
              { v: "false", label: "No" },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setValue(o.v)}
                className={
                  "rounded-lg border px-5 py-2 text-sm font-medium transition " +
                  (value === o.v ? "border-teal-600 bg-teal-50 text-teal-900" : "border-stone-200 bg-white hover:border-stone-300")
                }
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        {(q.inputType === "text" || q.inputType === "number") && (
          <input
            id="answer"
            type={q.inputType}
            inputMode={q.inputType === "number" ? "decimal" : undefined}
            min={q.inputType === "number" ? 0 : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={q.field === "location" ? "e.g. Seattle, King County, or 98104" : q.field === "monthlyIncome" ? "e.g. 2400" : ""}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
          />
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-800 disabled:opacity-50"
          >
            {pending ? "Building your plan…" : value.trim() ? "Continue" : "Skip and build my plan"}
          </button>
          <button type="button" onClick={onBack} disabled={pending} className="text-sm text-stone-500 hover:text-stone-800">
            Edit my description
          </button>
        </div>
      </form>
    </div>
  );
}

const STATUS_LABEL: Record<NonNullable<Situation["housingStatus"]>, string> = {
  housed_stable: "Housed, current on rent",
  housed_at_risk: "At risk of losing housing",
  eviction_notice: "Eviction notice received",
  unhoused: "Currently unhoused",
};

const NEED_LABEL: Record<string, string> = {
  rental_assistance: "rent help",
  food: "food",
  utility: "utilities",
  shelter: "shelter",
  employment: "work",
  legal: "legal help",
};

export function UnderstoodFacts({
  situation,
  candidateCount,
  parsedBy,
}: {
  situation: Situation;
  candidateCount?: number;
  parsedBy?: "gemini" | "fallback";
}) {
  const chips: string[] = [];
  const loc = situation.location;
  if (loc) chips.push([loc.city, loc.county, loc.state].filter(Boolean).join(", ") || `ZIP ${loc.zip}`);
  if (situation.housingStatus) chips.push(STATUS_LABEL[situation.housingStatus]);
  if (situation.householdSize) chips.push(`Household of ${situation.householdSize}`);
  if (situation.monthlyIncome !== undefined) chips.push(`$${situation.monthlyIncome.toLocaleString("en-US")}/month`);
  if (situation.hasChildren === true) chips.push("Has children");
  if (situation.hasChildren === false) chips.push("No children");
  if (situation.isVeteran === true) chips.push("Veteran");
  if (situation.isVeteran === false) chips.push("Not a veteran");
  if (situation.needs?.length) chips.push(`Needs: ${situation.needs.map((n) => NEED_LABEL[n] ?? n).join(", ")}`);

  return (
    <section className="rounded-xl border border-stone-200 bg-stone-100/60 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-stone-700">What we understood</h2>
        <span className="text-xs text-stone-500">
          {candidateCount !== undefined && `${candidateCount} possible resource${candidateCount === 1 ? "" : "s"} so far`}
          {parsedBy && ` · read by ${parsedBy === "gemini" ? "Gemini" : "keyword reader"}`}
        </span>
      </div>
      {chips.length ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {chips.map((c) => (
            <li key={c} className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-800">
              {c}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-stone-500">We could not pick out specific details yet.</p>
      )}
    </section>
  );
}
