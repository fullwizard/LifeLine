"use client";

export function CrisisSupport({
  pending,
  onContinue,
  onEdit,
}: {
  pending: boolean;
  onContinue: () => void;
  onEdit: () => void;
}) {
  return (
    <section
      role="alert"
      className="rounded-none border-2 border-red-700 bg-red-50 p-5 text-red-950 sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Support is available now</p>
      <h2 className="mt-2 text-2xl font-semibold">You do not have to handle this alone.</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed">
        If you may hurt yourself or are thinking about suicide, call or text the 988 Suicide &amp; Crisis Lifeline
        for free, confidential support, any time.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <a
          href="tel:988"
          className="rounded-none bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800"
        >
          Call 988
        </a>
        <a
          href="https://988lifeline.org/get-help/"
          target="_blank"
          rel="noreferrer"
          className="rounded-none border border-red-700 bg-white px-5 py-2.5 text-sm font-medium text-red-800 transition hover:bg-red-100"
        >
          More info
        </a>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
        <button
          type="button"
          onClick={onContinue}
          disabled={pending}
          className="font-medium text-red-800 underline underline-offset-4 hover:text-red-950 disabled:text-red-300"
        >
          {pending ? "Continuing…" : "Continue to a few focused questions"}
        </button>
        <button type="button" onClick={onEdit} disabled={pending} className="text-red-700 hover:text-red-950 disabled:text-red-300">
          Edit my description
        </button>
      </div>
    </section>
  );
}

/** Compact reminder shown on later steps once a safety concern was detected. */
export function CrisisBanner() {
  return (
    <div
      role="note"
      className="flex flex-wrap items-center justify-between gap-3 rounded-none border-l-4 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-950"
    >
      <span>Need to talk to someone right now? The 988 Suicide &amp; Crisis Lifeline is free and open 24/7.</span>
      <a href="tel:988" className="rounded-none bg-red-700 px-3 py-1.5 font-semibold text-white hover:bg-red-800">
        Call 988
      </a>
    </div>
  );
}
