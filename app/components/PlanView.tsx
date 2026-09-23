"use client";

import type { Plan } from "@/lib/types";
import { UnderstoodFacts } from "./FollowUpStep";
import { ResourceCard } from "./ResourceCard";

export function PlanView({ plan, onReset }: { plan: Plan; onReset: () => void }) {
  const confirmed = plan.ranked.filter((r) => !r.needsVerification).length;
  return (
    <div className="space-y-6">
      <UnderstoodFacts situation={plan.situation} />

      <section className="rounded-none bg-accent-50 p-5">
        <h2 className="text-lg font-semibold text-accent-950">Your plan</h2>
        <p className="mt-2 text-neutral-800 leading-relaxed">{plan.summary}</p>
        {plan.steps.length > 0 && (
          <ol className="mt-4 space-y-1.5 text-sm text-neutral-800">
            {plan.steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent-700" aria-hidden>
                  •
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {plan.ranked.length} matching resource{plan.ranked.length === 1 ? "" : "s"}
          </h2>
          <p className="text-xs text-neutral-500">
            {confirmed} fully confirmed · {plan.ranked.length - confirmed} need verification · {plan.excludedCount} ruled out
          </p>
        </div>
        <Legend />
        {plan.ranked.length === 0 ? (
          <p className="mt-4 rounded-none bg-paper p-4 text-sm text-neutral-600">
            No resources matched. Try adding your city or county.
          </p>
        ) : (
          <ol className="mt-4 space-y-4">
            {plan.ranked.map((r, i) => (
              <li key={r.resource.id}>
                <ResourceCard rank={i + 1} scored={r} note={plan.resourceNotes[r.resource.id]} />
              </li>
            ))}
          </ol>
        )}
      </section>

      {plan.related.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Also worth knowing</h2>
          <p className="text-xs text-neutral-500">
            Programs in related categories that often help in situations like yours. Same rules, same checks.
          </p>
          <ol className="mt-4 space-y-4">
            {plan.related.map((r, i) => (
              <li key={r.resource.id}>
                <ResourceCard rank={plan.ranked.length + i + 1} scored={r} note={plan.resourceNotes[r.resource.id]} />
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="rounded-none bg-amber-50 px-4 py-3 text-xs text-amber-900 leading-relaxed">
        {plan.disclaimer}
      </p>

      <button type="button" onClick={onReset} className="text-sm font-medium text-accent-700 hover:text-accent-900">
        ← Start over
      </button>
    </div>
  );
}

function Legend() {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden /> Confirmed from what you told us
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden /> Needs verification with the organization
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-400" aria-hidden /> Not met yet
      </li>
    </ul>
  );
}
