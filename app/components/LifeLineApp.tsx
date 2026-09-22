"use client";

import { useState, useTransition } from "react";
import type { AskableField, Plan } from "@/lib/types";
import { answerAndBuildPlan, answerAndContinue, parseAndAsk, type ParseResponse } from "../actions";
import { FollowUpStep } from "./FollowUpStep";
import { PlanView } from "./PlanView";
import { SituationForm } from "./SituationForm";

type Step = { kind: "input" } | { kind: "followup"; parsed: ParseResponse } | { kind: "plan"; plan: Plan };

export function LifeLineApp() {
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
        if (!answer) {
          const plan = await answerAndBuildPlan(parsed.situation, parsed.parsedBy, null);
          setStep({ kind: "plan", plan });
          return;
        }
        const next = await answerAndContinue(parsed.situation, parsed.parsedBy, answer);
        if ("plan" in next) {
          setStep({ kind: "plan", plan: next.plan });
        } else {
          setStep({ kind: "followup", parsed: next });
        }
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
      {step.kind === "input" && (
        <h1 className="headline-georgia mx-auto max-w-4xl text-center text-5xl sm:text-6xl lg:text-7xl leading-[1.05] text-balance">
          A Personalized Assistance Plan, At Your Finger Tips.
        </h1>
      )}
      {step.kind !== "input" && <StepIndicator current={step.kind} />}
      {error && (
        <div role="alert" className="rounded-none border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {step.kind === "input" && (
        <SituationForm initialText={text} pending={pending} onSubmit={submitSituation} />
      )}
      {step.kind === "followup" && (
        <FollowUpStep
          key={step.parsed.question?.field}
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
  const labels = {
    input: "Step 1: Tell us about your situation.",
    followup: "Step 2: A little more about you.",
    plan: "Step 3: Your next steps.",
  };
  return <h2 className="text-xl sm:text-2xl font-medium text-accent-700" aria-live="polite">{labels[current]}</h2>;
}
