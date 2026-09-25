"use client";

import { useEffect, useRef, useState } from "react";

const GUIDANCE = "Where you live, who lives with you, what you are facing, and roughly what your household earns. Housing, food, bills, legal trouble, health, work: anything counts. Anything you leave out, we may ask about.";
const EXAMPLES = [
  "I live in San Jose with two kids. I'm behind on rent and got an eviction notice. I earn $2,400 a month and need utility help too.",
  "Veteran in Redwood City. Lost my job last month and I'm sleeping in my car. Need shelter and help finding work.",
  "I'm 71 in Daly City, living alone on $1,500 a month from Social Security. My PG&E bill is overdue and I'm skipping meals to cover it.",
  "Single mom in Mountain View. My hours got cut and I can't afford groceries this month. No eviction notice, just stretched thin.",
];
export function SituationForm({
  initialText,
  pending,
  onSubmit,
}: {
  initialText: string;
  pending: boolean;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState(initialText);
  const [placeholderText, setPlaceholderText] = useState(GUIDANCE);
  const [focused, setFocused] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSubmit = text.trim().length > 0 && !pending;

  function tryExample() {
    setText(EXAMPLES[exampleIndex]);
    setExampleIndex((index) => (index + 1) % EXAMPLES.length);
    textareaRef.current?.focus();
  }

  useEffect(() => {
    if (text.length > 0 || focused || pending) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (reducedMotion.matches) return;

    let sampleIndex = 0;
    let characterIndex = 0;
    let deleting = false;
    let timer = window.setTimeout(tick, 2200);

    function tick() {
      if (document.hidden) {
        timer = window.setTimeout(tick, 500);
        return;
      }

      const sample = EXAMPLES[sampleIndex];

      if (deleting) {
        characterIndex = Math.max(0, characterIndex - 1);
        setPlaceholderText(sample.slice(0, characterIndex));

        if (characterIndex === 0) {
          sampleIndex = (sampleIndex + 1) % EXAMPLES.length;
          deleting = false;
          timer = window.setTimeout(tick, 500);
        } else {
          timer = window.setTimeout(tick, 24);
        }
        return;
      }

      characterIndex = Math.min(sample.length, characterIndex + 1);
      setPlaceholderText(sample.slice(0, characterIndex));

      if (characterIndex === sample.length) {
        deleting = true;
        timer = window.setTimeout(tick, 2200);
      } else {
        timer = window.setTimeout(tick, 42);
      }
    }

    return () => window.clearTimeout(timer);
  }, [text, focused, pending]);

  return (
    <form
      className="mx-auto w-full max-w-3xl"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(text);
      }}
    >
      <div className="rounded-none space-y-5 bg-sunflower p-5 sm:p-8">
        <label htmlFor="situation" className="block font-sans font-semibold text-2xl text-neutral-900">
          Tell us what is going on.
        </label>
        <p id="situation-guidance" className="-mt-2 text-base leading-relaxed text-neutral-800">{GUIDANCE}</p>
        <div className="rounded-none bg-paper focus-within:ring-2 focus-within:ring-accent-600">
          <textarea
            ref={textareaRef}
            id="situation"
            name="situation"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value.length === 0) setPlaceholderText(GUIDANCE);
            }}
            onFocus={() => {
              setFocused(true);
              if (text.length === 0) setPlaceholderText(GUIDANCE);
            }}
            onBlur={() => setFocused(false)}
            aria-describedby="situation-guidance"
            rows={6}
            maxLength={4000}
            placeholder={placeholderText}
            className="block w-full resize-y border-0 bg-transparent px-4 py-3 text-base leading-relaxed placeholder:text-gray-500 placeholder:opacity-100 focus:outline-none"
            disabled={pending}
          />
          <div className="flex justify-end px-4 pb-3">
            <button
              type="button"
              onClick={tryExample}
              disabled={pending}
              className="inline-flex min-h-8 items-center gap-1.5 bg-transparent text-sm font-medium text-accent-700 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-gray-500"
            >
              Try an example
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M9 5 11.5 11.5 18 14 11.5 16.5 9 23 6.5 16.5 0 14 6.5 11.5Z" transform="translate(2 -2) scale(.9)" />
                <path d="m18 2 1.2 3.8L23 7l-3.8 1.2L18 12l-1.2-3.8L13 7l3.8-1.2Z" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-none bg-accent-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-600"
          >
            {pending ? "Reading your situation…" : "Find help"}
          </button>
          <span className="text-xs text-neutral-500">
            Running fully offline with a keyword reader. Your data isn&apos;t going to a 3rd party.
          </span>
        </div>
      </div>
      <p className="mt-7 px-0 text-xs text-neutral-500 leading-relaxed sm:px-8">
        Nothing you type is saved. LifeLine is an MVP running on California resource data for the
        area. Always confirm program details with the organization.
      </p>
    </form>
  );
}
