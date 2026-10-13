"use client";

import { useMemo, useRef, useState } from "react";
import type { MessageKey } from "@/lib/i18n";
import type { ResourceCategory } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";
import { Button, Spinner } from "./ui";

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

const EXAMPLE_KEYS: MessageKey[] = ["form.example.1", "form.example.2", "form.example.3", "form.example.4"];

export function SituationForm({
  initialText,
  initialNeeds,
  pending,
  onSubmit,
}: {
  initialText: string;
  initialNeeds: ResourceCategory[];
  pending: boolean;
  onSubmit: (text: string, needs: ResourceCategory[]) => void;
}) {
  const { t } = useLanguage();
  const examples = useMemo(() => EXAMPLE_KEYS.map((k) => t(k)), [t]);
  const [text, setText] = useState(initialText);
  const [needs, setNeeds] = useState<ResourceCategory[]>(initialNeeds);
  const [exampleIndex, setExampleIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSubmit = (text.trim().length > 0 || needs.length > 0) && !pending;

  function toggleNeed(need: ResourceCategory) {
    setNeeds((current) => (current.includes(need) ? current.filter((n) => n !== need) : [...current, need]));
  }

  function tryExample() {
    setText(examples[exampleIndex]);
    setExampleIndex((i) => (i + 1) % examples.length);
    textareaRef.current?.focus();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(text, needs);
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor="situation" className="text-xl font-semibold text-neutral-950">
          {t("form.label")}
        </label>
        <button
          type="button"
          onClick={tryExample}
          disabled={pending}
          className="shrink-0 text-sm font-semibold text-accent-700 hover:text-accent-900 disabled:text-neutral-400"
        >
          {t("form.example")} ✦
        </button>
      </div>
      <textarea
        ref={textareaRef}
        id="situation"
        name="situation"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) onSubmit(text, needs);
        }}
        rows={7}
        maxLength={4000}
        placeholder={examples[0]}
        disabled={pending}
        className="mt-4 block w-full resize-y rounded-[2px] border border-neutral-300 bg-paper px-4 py-3 text-base leading-relaxed text-neutral-950 placeholder:text-neutral-400 focus:border-accent-700 focus:outline-none"
      />

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-neutral-700">{t("form.chips")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PICKABLE_NEEDS.map((need) => (
            <button
              key={need}
              type="button"
              className="chip"
              aria-pressed={needs.includes(need)}
              onClick={() => toggleNeed(need)}
              disabled={pending}
            >
              {t(`need.${need}` as MessageKey)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 flex justify-end">
        <Button type="submit" variant="primary" disabled={!canSubmit} className="shrink-0">
          {pending && <Spinner />}
          {pending ? t("form.submitting") : t("form.submit")} {!pending && <span aria-hidden>→</span>}
        </Button>
      </div>
    </form>
  );
}
