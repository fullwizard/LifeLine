"use client";

import { CRISIS_LINE } from "@/lib/safety/crisis";

export function CrisisStep({ onContinue, pending }: { onContinue: () => void; pending: boolean }) {
  return (
    <section
      role="region"
      aria-labelledby="crisis-heading"
      className="rounded-none border-4 border-red-600 bg-paper p-6 sm:p-8 space-y-5"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Before anything else</p>
        <h2 id="crisis-heading" className="mt-1 text-2xl sm:text-3xl font-semibold text-neutral-900">
          It sounds like you might be going through something very hard right now.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-neutral-800">
          You do not have to handle this alone. The {CRISIS_LINE.name} is free, confidential, and open 24 hours a day.
          Call or text <strong>988</strong> to talk to a trained counselor now. Your housing plan will still be here
          when you are ready.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={CRISIS_LINE.tel}
          className="inline-flex items-center gap-2 rounded-none bg-red-600 px-6 py-3 text-lg font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-red-700"
        >
          <span aria-hidden>📞</span> Call 988
        </a>
        <a
          href={CRISIS_LINE.sms}
          className="inline-flex items-center rounded-none border-2 border-red-600 px-5 py-3 text-base font-semibold text-red-700 transition hover:bg-red-50"
        >
          Text 988
        </a>
        <a
          href={CRISIS_LINE.infoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-none border border-neutral-300 bg-paper px-5 py-3 text-base font-medium text-neutral-800 transition hover:bg-neutral-50"
        >
          More info
        </a>
      </div>

      <p className="text-sm text-neutral-600">
        If you are in immediate danger, call 911. Outside the US, find a local line at{" "}
        <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer" className="underline">
          findahelpline.com
        </a>
        .
      </p>

      <div className="border-t border-neutral-200 pt-4">
        <button
          type="button"
          onClick={onContinue}
          disabled={pending}
          className="text-sm font-medium text-accent-700 underline-offset-4 hover:underline disabled:opacity-50"
        >
          {pending ? "Loading your plan…" : "Continue to my housing plan →"}
        </button>
      </div>
    </section>
  );
}

/** Compact reminder shown on later steps once a crisis signal was detected. */
export function CrisisBanner() {
  return (
    <div role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-none border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-900">
      <span>
        Need to talk to someone right now? The {CRISIS_LINE.name} is available 24/7.
      </span>
      <a href={CRISIS_LINE.tel} className="rounded-none bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700">
        Call 988
      </a>
    </div>
  );
}
