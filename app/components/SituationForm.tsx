"use client";

import { useState } from "react";

const EXAMPLES = [
  "I live in Seattle with my two kids. I got a pay-or-vacate notice yesterday. I make about $2,400 a month and I'm behind on rent. Our power might get shut off too.",
  "Veteran in Kent, WA. Lost my job last month and I'm sleeping in my car. Need shelter and help finding work.",
  "Family of 4 in Tacoma, behind on rent, no eviction notice yet. Income around $3,800 a month.",
];

export function SituationForm({
  initialText,
  pending,
  aiEnabled,
  onSubmit,
}: {
  initialText: string;
  pending: boolean;
  aiEnabled: boolean;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState(initialText);
  const canSubmit = text.trim().length > 0 && !pending;

  return (
    <form
      className="grid items-start gap-8 md:grid-cols-[1.58fr_1fr] md:gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(text);
      }}
    >
      <div>
        <h2 className="mb-4 text-xl sm:text-2xl font-medium text-accent-700">Step 1: Tell us about your situation.</h2>
        <div className="space-y-5 bg-sunflower p-5 sm:p-8">
      <label htmlFor="situation" className="block font-sans font-semibold text-2xl text-neutral-900">
        What is happening with your housing?
      </label>
      <textarea
        id="situation"
        name="situation"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        maxLength={4000}
        placeholder="Where you live, who lives with you, what you are facing, and roughly what your household earns. Anything you leave out, we may ask about."
        className="w-full rounded-none border-0 bg-paper px-4 py-3 text-base leading-relaxed placeholder:text-neutral-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600"
        disabled={pending}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-none bg-accent-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-600"
        >
          {pending ? "Reading your situation…" : "Find help"}
        </button>
        <span className="text-xs text-neutral-500">
          {aiEnabled ? "Using Gemini to read your description." : "Running fully offline with a keyword reader."}
        </span>
      </div>
      </div>
        <p className="mt-7 px-0 text-xs text-neutral-500 leading-relaxed sm:px-8">
          Nothing you type is saved. LifeLine is an MVP running on sample resource data for the Seattle
          area. Always confirm program details with the organization.
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-neutral-600 uppercase tracking-wide md:min-h-8 md:flex md:items-center">Try an example</p>
        <ul className="mt-4 space-y-5">
          {EXAMPLES.map((ex, index) => (
            <li key={ex}>
              <button
                type="button"
                onClick={() => setText(ex)}
                disabled={pending}
                className="group w-full rounded-none bg-sunflower p-5 text-left text-sm leading-relaxed text-neutral-800 transition-colors hover:bg-sunflower-hover disabled:cursor-not-allowed"
              >
                <span className="mb-3 block font-sans font-semibold text-xl text-accent-700" aria-hidden="true">0{index + 1} <span className="float-right">↗</span></span>
                {ex}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </form>
  );
}
