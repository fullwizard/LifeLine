"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MessageKey } from "@/lib/i18n";
import type { ResourceCategory } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";

/** The common reasons people come; the rest are reachable by typing. */
export const PICKABLE_NEEDS: ResourceCategory[] = [
  "rental_assistance",
  "food",
  "utility",
  "shelter",
  "employment",
  "health",
  "legal",
  "benefits",
  "family_support",
  "mental_health",
];

export function SituationForm({
  initialText,
  initialNeeds,
  pending,
  aiEnabled,
  onSubmit,
}: {
  initialText: string;
  initialNeeds: ResourceCategory[];
  pending: boolean;
  aiEnabled: boolean;
  onSubmit: (text: string, needs: ResourceCategory[]) => void;
}) {
  const { t } = useLanguage();
  const GUIDANCE = t("form.guidance");
  const EXAMPLES = useMemo(
    () => (["form.example.1", "form.example.2", "form.example.3", "form.example.4"] as MessageKey[]).map((k) => t(k)),
    [t],
  );
  const [text, setText] = useState(initialText);
  const [needs, setNeeds] = useState<ResourceCategory[]>(initialNeeds);
  // Typed-out example while idle; null shows the guidance in the chosen language.
  const [animated, setAnimated] = useState<string | null>(null);
  const placeholderText = animated ?? GUIDANCE;
  const [focused, setFocused] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSubmit = (text.trim().length > 0 || needs.length > 0) && !pending;

  function toggleNeed(need: ResourceCategory) {
    setNeeds((current) => (current.includes(need) ? current.filter((n) => n !== need) : [...current, need]));
  }

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
        setAnimated(sample.slice(0, characterIndex));

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
      setAnimated(sample.slice(0, characterIndex));

      if (characterIndex === sample.length) {
        deleting = true;
        timer = window.setTimeout(tick, 2200);
      } else {
        timer = window.setTimeout(tick, 42);
      }
    }

    return () => window.clearTimeout(timer);
  }, [text, focused, pending, EXAMPLES]);

  return (
    <form
      className="mx-auto w-full max-w-3xl"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(text, needs);
      }}
    >
      <div className="rounded-none space-y-5 bg-sunflower p-5 sm:p-8">
        <label htmlFor="situation" className="block font-sans font-semibold text-2xl text-neutral-900">
          {t("form.label")}
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
              if (e.target.value.length === 0) setAnimated(null);
            }}
            onFocus={() => {
              setFocused(true);
              if (text.length === 0) setAnimated(null);
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
              {t("form.example")}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M9 5 11.5 11.5 18 14 11.5 16.5 9 23 6.5 16.5 0 14 6.5 11.5Z" transform="translate(2 -2) scale(.9)" />
                <path d="m18 2 1.2 3.8L23 7l-3.8 1.2L18 12l-1.2-3.8L13 7l3.8-1.2Z" />
              </svg>
            </button>
          </div>
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-neutral-800">{t("form.chips")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PICKABLE_NEEDS.map((need) => (
              <button
                key={need}
                type="button"
                aria-pressed={needs.includes(need)}
                onClick={() => toggleNeed(need)}
                disabled={pending}
                className="need-chip rounded-none border border-neutral-300 bg-paper px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-accent-600"
              >
                {t(`need.${need}` as MessageKey)}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-none bg-accent-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-600"
          >
            {pending ? t("form.submitting") : t("form.submit")}
          </button>
          <span className="text-xs text-neutral-500">{t(aiEnabled ? "form.ai" : "form.offline")}</span>
        </div>
      </div>
      <p className="mt-7 px-0 text-xs text-neutral-500 leading-relaxed sm:px-8">
        {t("form.privacy")}
      </p>
    </form>
  );
}
