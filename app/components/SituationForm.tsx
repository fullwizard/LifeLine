"use client";

import { useMemo, useRef, useState } from "react";
import type { MessageKey } from "@/lib/i18n";
import type { ResourceCategory } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";
import { Button, Card, Spinner } from "./ui";

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
      <Card className="shadow-sm">
        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="situation" className="text-base font-semibold text-neutral-900">
                {t("form.label")}
              </label>
              <button
                type="button"
                onClick={tryExample}
                disabled={pending}
                className="text-sm font-medium text-accent-700 hover:text-accent-800 disabled:text-neutral-400"
              >
                {t("form.example")}
              </button>
            </div>
            <p id="situation-guidance" className="mt-1 text-sm leading-relaxed text-neutral-500">
              {t("form.guidance")}
            </p>
            <textarea
              ref={textareaRef}
              id="situation"
              name="situation"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) onSubmit(text, needs);
              }}
              aria-describedby="situation-guidance"
              rows={5}
              maxLength={4000}
              placeholder={examples[0]}
              disabled={pending}
              className="mt-3 block w-full resize-y rounded-md border border-neutral-300 bg-paper px-3.5 py-3 text-base leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600/20"
            />
          </div>

          <fieldset>
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
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-neutral-200 bg-neutral-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 rounded-b-lg">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-neutral-500">
            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <span>{t(aiEnabled ? "form.ai" : "form.offline")}</span>
          </p>
          <Button type="submit" variant="primary" disabled={!canSubmit} className="shrink-0">
            {pending && <Spinner />}
            {pending ? t("form.submitting") : t("form.submit")}
          </Button>
        </div>
      </Card>
      <p className="mt-4 text-xs leading-relaxed text-neutral-500">{t("form.privacy")}</p>
    </form>
  );
}
