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
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(text);
      }}
    >
      <label htmlFor="situation" className="block text-sm font-medium text-stone-800">
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
        className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base leading-relaxed shadow-sm placeholder:text-stone-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
        disabled={pending}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Reading your situation…" : "Find help"}
        </button>
        <span className="text-xs text-stone-500">
          {aiEnabled ? "Using Gemini to read your description." : "Running fully offline with a keyword reader."}
        </span>
      </div>
      <div className="pt-2">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Try an example</p>
        <ul className="mt-2 flex flex-col gap-2">
          {EXAMPLES.map((ex) => (
            <li key={ex}>
              <button
                type="button"
                onClick={() => setText(ex)}
                disabled={pending}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-sm text-stone-700 transition hover:border-teal-600 hover:bg-teal-50"
              >
                {ex}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </form>
  );
}
