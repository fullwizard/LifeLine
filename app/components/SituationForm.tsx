"use client";

import { useEffect, useState } from "react";

const GUIDANCE = "Where you live, who lives with you, what you are facing, and roughly what your household earns. Anything you leave out, we may ask about.";
const PLACEHOLDERS = [
  GUIDANCE,
  "For example: I live in Seattle with two kids. I'm behind on rent and got an eviction notice. I earn $2,400 a month and need utility help too.",
  "For example: Veteran in Kent, WA. Lost my job last month and I'm sleeping in my car. Need shelter and help finding work.",
  "For example: Family of 4 in Tacoma, behind on rent, no eviction notice yet. Income around $3,800 a month.",
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
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const canSubmit = text.trim().length > 0 && !pending;

  useEffect(() => {
    if (text.length > 0 || focused || pending) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setInterval(() => {
      if (!reducedMotion.matches && !document.hidden) {
        setPlaceholderIndex((index) => (index + 1) % PLACEHOLDERS.length);
      }
    }, 4000);

    return () => window.clearInterval(timer);
  }, [text, focused, pending]);

  return (
    <form
      className="mx-auto w-full max-w-3xl"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(text);
      }}
    >
      <h2 className="mb-4 text-center text-xl sm:text-2xl font-medium text-accent-700">Step 1: Tell us about your situation.</h2>
      <div className="rounded-none space-y-5 bg-sunflower p-5 sm:p-8">
        <label htmlFor="situation" className="block font-sans font-semibold text-2xl text-neutral-900">
          What is happening with your housing?
        </label>
        <p id="situation-guidance" className="sr-only">{GUIDANCE}</p>
        <textarea
          id="situation"
          name="situation"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-describedby="situation-guidance"
          rows={6}
          maxLength={4000}
          placeholder={PLACEHOLDERS[placeholderIndex]}
          className="w-full rounded-none border-0 bg-paper px-4 py-3 text-base leading-relaxed placeholder:text-gray-500 placeholder:opacity-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600"
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
    </form>
  );
}
