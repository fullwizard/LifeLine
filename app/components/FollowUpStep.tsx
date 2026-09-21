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
    <div className="grid items-start gap-8 md:grid-cols-[1fr_1.65fr]">
      <UnderstoodFacts situation={parsed.situation} candidateCount={parsed.candidateCount} />

      <form
        className="rounded-none bg-paper p-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          onAnswer(value.trim() ? { field: q.field, value } : null);
        }}
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent-700">One quick question</p>
          <label htmlFor="answer" className="mt-1 block text-lg font-medium">
            {q.prompt}
          </label>
          <p className="mt-1 text-sm text-neutral-500">{q.rationale}</p>
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
          <input
            id="answer"
            type={q.inputType}
            inputMode={q.inputType === "number" ? "decimal" : undefined}
            min={q.inputType === "number" ? 0 : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={q.field === "location" ? "e.g. Seattle, King County, or 98104" : q.field === "monthlyIncome" ? "e.g. 2400" : ""}
            className="w-full rounded-none border border-neutral-300 px-3 py-2 text-base focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600"
          />
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="rounded-none bg-accent-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-800 disabled:bg-neutral-200 disabled:text-neutral-600"
          >
            {pending ? "Building your plan…" : value.trim() ? "Continue" : "Skip and build my plan"}
          </button>
          <button type="button" onClick={onBack} disabled={pending} className="text-sm text-neutral-500 hover:text-neutral-800">
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
}: {
  situation: Situation;
  candidateCount?: number;
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
    <section className="rounded-none bg-neutral-100 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-neutral-700">What we understood</h2>
        {candidateCount !== undefined && (
          <span className="text-xs text-neutral-500">
            {candidateCount} possible resource{candidateCount === 1 ? "" : "s"} so far
          </span>
        )}
      </div>
      {chips.length ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {chips.map((c) => (
            <li key={c} className="rounded-none bg-paper px-3 py-1 text-xs text-neutral-800">
              {c}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-neutral-500">We could not pick out specific details yet.</p>
      )}
    </section>
  );
}
