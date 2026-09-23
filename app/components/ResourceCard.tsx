"use client";

import { useState } from "react";
import type { BreakdownItem, ScoredResource } from "@/lib/types";

const CATEGORY_LABEL: Record<ScoredResource["resource"]["category"], string> = {
  rental_assistance: "Rent help",
  food: "Food",
  utility: "Utilities",
  shelter: "Shelter",
  employment: "Work",
  legal: "Legal",
  health: "Health",
  benefits: "Benefits",
  family_support: "Family support",
  veteran_support: "Veteran services",
  older_adult_support: "Older adult services",
  disability: "Disability services",
  mental_health: "Mental health",
  substance_use: "Recovery support",
  condition_support: "Condition support",
};

const FACTOR_LABEL: Record<BreakdownItem["factor"], string> = {
  service_area: "Service area",
  need_match: "Matches your need",
  urgency_fit: "Speed",
  income_limit: "Income limit",
  eviction_notice: "Eviction notice",
  children: "Children",
  veteran: "Veteran status",
  housing_status: "Housing status",
  other_conditions: "Other conditions",
  documents: "Documents",
  distance: "Distance",
};

export function ResourceCard({ rank, scored, note }: { rank: number; scored: ScoredResource; note?: string }) {
  const { resource, breakdown, needsVerification, score } = scored;
  const [open, setOpen] = useState(rank === 1);
  const unverified = breakdown.filter((b) => b.status === "unverified");

  return (
    <article id={`resource-${resource.id}`} className="rounded-none bg-paper p-5 sm:p-7 scroll-mt-24 target:ring-2 target:ring-accent-600">
      <div className="flex items-start gap-4">
        <span className="shrink-0 font-sans font-semibold text-4xl leading-none text-accent-700">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-none bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
              {CATEGORY_LABEL[resource.category]}
            </span>
            {needsVerification ? (
              <span className="rounded-none bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                {unverified.length} thing{unverified.length === 1 ? "" : "s"} to verify
              </span>
            ) : (
              <span className="rounded-none bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                All checks confirmed
              </span>
            )}
          </div>
          <h3 className="mt-2 text-lg font-semibold leading-snug">{resource.name}</h3>
          <p className="text-sm text-neutral-500">{resource.organization}</p>
          <p className="mt-2 text-sm text-neutral-700 leading-relaxed">{note ?? resource.description}</p>

          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <a
              href={resource.application_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-none bg-accent-700 px-3.5 py-1.5 font-medium text-white hover:bg-accent-800"
            >
              Apply / learn more
            </a>
            {resource.phone && (
              <a
                href={`tel:${resource.phone.replace(/[^0-9+]/g, "")}`}
                className="rounded-none border border-neutral-300 px-3.5 py-1.5 font-medium text-neutral-800 hover:bg-neutral-50"
              >
                Call {resource.phone}
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-4 text-sm font-medium text-accent-700 hover:text-accent-900"
          >
            {open ? "Hide" : "Show"} why this is #{rank} · score {score}
          </button>

          {open && (
            <ul className="mt-2 space-y-1 rounded-none bg-neutral-50">
              {breakdown.map((b) => (
                <li key={b.factor} className="flex gap-3 px-3 py-2 text-sm">
                  <StatusDot status={b.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-medium text-neutral-800">{FACTOR_LABEL[b.factor]}</span>
                      <span className="text-xs text-neutral-500">
                        {STATUS_TEXT[b.status]}
                        {b.points > 0 ? ` · +${b.points}` : ""}
                      </span>
                    </div>
                    <p className="text-neutral-600">{b.detail}</p>
                  </div>
                </li>
              ))}
              {resource.required_documents.length > 0 && (
                <li className="px-3 py-2 text-xs text-neutral-500">
                  Bring: {resource.required_documents.join(", ")}.
                </li>
              )}
              <li className="px-3 py-2 text-xs text-neutral-500">
                Source:{" "}
                <a href={resource.source_url} target="_blank" rel="noopener noreferrer" className="underline">
                  {new URL(resource.source_url).hostname}
                </a>
                {resource.last_verified && ` · listing verified ${resource.last_verified}`}
              </li>
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}

const STATUS_TEXT: Record<BreakdownItem["status"], string> = {
  met: "Confirmed",
  unverified: "Needs verification",
  unmet: "Not met yet",
};

function StatusDot({ status }: { status: BreakdownItem["status"] }) {
  const color = status === "met" ? "bg-emerald-500" : status === "unverified" ? "bg-amber-500" : "bg-neutral-400";
  return <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${color}`} role="img" aria-label={STATUS_TEXT[status]} />;
}
