"use client";

import { useState, useTransition } from "react";
import type { AskableField, Plan } from "@/lib/types";
import { answerAndBuildPlan, parseAndAsk, type ParseResponse } from "../actions";
import { FollowUpStep } from "./FollowUpStep";
import { PlanView } from "./PlanView";
import { SituationForm } from "./SituationForm";

type Step = { kind: "input" } | { kind: "followup"; parsed: ParseResponse } | { kind: "plan"; plan: Plan };

export function LifeLineApp({ aiEnabled }: { aiEnabled: boolean }) {
  const [step, setStep] = useState<Step>({ kind: "input" });
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitSituation(value: string) {
    setError(null);
    setText(value);
    startTransition(async () => {
      try {
        const parsed = await parseAndAsk(value);
        if (parsed.question) {
          setStep({ kind: "followup", parsed });
        } else {
          const plan = await answerAndBuildPlan(parsed.situation, parsed.parsedBy, null);
          setStep({ kind: "plan", plan });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    });
  }

  function submitAnswer(parsed: ParseResponse, answer: { field: AskableField; value: string } | null) {
    setError(null);
    startTransition(async () => {
      try {
        const plan = await answerAndBuildPlan(parsed.situation, parsed.parsedBy, answer);
        setStep({ kind: "plan", plan });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    });
  }

  function reset() {
    setError(null);
    setStep({ kind: "input" });
  }

  return (
    <div className="space-y-6">
      <StepIndicator current={step.kind} />
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {step.kind === "input" && (
        <SituationForm initialText={text} pending={pending} aiEnabled={aiEnabled} onSubmit={submitSituation} />
      )}
      {step.kind === "followup" && (
        <FollowUpStep
          parsed={step.parsed}
          pending={pending}
          onAnswer={(a) => submitAnswer(step.parsed, a)}
          onBack={reset}
        />
      )}
      {step.kind === "plan" && <PlanView plan={step.plan} onReset={reset} />}
    </div>
  );
}

function StepIndicator({ current }: { current: Step["kind"] }) {
  const steps: { kind: Step["kind"]; label: string }[] = [
    { kind: "input", label: "Your situation" },
    { kind: "followup", label: "One question" },
    { kind: "plan", label: "Your plan" },
  ];
  const idx = steps.findIndex((s) => s.kind === current);
  return (
    <ol className="flex items-center gap-2 text-xs sm:text-sm text-stone-500" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s.kind} className="flex items-center gap-2">
          <span
            className={
              "inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium " +
              (i <= idx ? "border-teal-700 bg-teal-700 text-white" : "border-stone-300 bg-white text-stone-500")
            }
            aria-current={i === idx ? "step" : undefined}
          >
            {i + 1}
          </span>
          <span className={i === idx ? "font-medium text-stone-900" : ""}>{s.label}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-stone-300" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}
