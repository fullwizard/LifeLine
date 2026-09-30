"use client";

import { useState, useTransition } from "react";
import type { MessageKey } from "@/lib/i18n";
import type { AskableField, Plan, ResourceCategory } from "@/lib/types";
import { hasImmediateSafetyConcern } from "@/lib/safety";
import { answerAndBuildPlan, answerAndContinue, parseAndAsk, refinePlan as refinePlanAction, updateNeeds, type ParseResponse } from "../actions";
import { CrisisBanner, CrisisSupport } from "./CrisisSupport";
import { FollowUpStep } from "./FollowUpStep";
import { useLanguage } from "./LanguageProvider";
import { PlanView } from "./PlanView";
import { SituationForm } from "./SituationForm";

type Step =
  | { kind: "input" }
  | { kind: "crisis"; parsed: ParseResponse }
  | { kind: "followup"; parsed: ParseResponse }
  | { kind: "plan"; plan: Plan };

export function LifeLineApp({ aiEnabled }: { aiEnabled: boolean }) {
  const { lang, t } = useLanguage();
  const [step, setStep] = useState<Step>({ kind: "input" });
  const [text, setText] = useState("");
  const [pickedNeeds, setPickedNeeds] = useState<ResourceCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(task: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await task();
      } catch (e) {
        setError(e instanceof Error && e.message ? e.message : t("app.error"));
      }
    });
  }

  function submitSituation(value: string, needs: ResourceCategory[]) {
    setText(value);
    setPickedNeeds(needs);
    run(async () => {
      const parsed = await parseAndAsk(value, needs);
      if (hasImmediateSafetyConcern(parsed.situation)) {
        setStep({ kind: "crisis", parsed });
      } else if (parsed.question) {
        setStep({ kind: "followup", parsed });
      } else {
        setStep({ kind: "plan", plan: await answerAndBuildPlan(parsed.situation, parsed.parsedBy, null, lang) });
      }
    });
  }

  function continueFromCrisis(parsed: ParseResponse) {
    if (parsed.question) {
      setError(null);
      setStep({ kind: "followup", parsed });
      return;
    }
    run(async () => {
      setStep({ kind: "plan", plan: await answerAndBuildPlan(parsed.situation, parsed.parsedBy, null, lang) });
    });
  }

  function submitAnswer(parsed: ParseResponse, answer: { field: AskableField; value: string } | null) {
    run(async () => {
      if (!answer) {
        setStep({ kind: "plan", plan: await answerAndBuildPlan(parsed.situation, parsed.parsedBy, null, lang) });
        return;
      }
      const next = await answerAndContinue(parsed.situation, parsed.parsedBy, answer, lang);
      setStep("plan" in next ? { kind: "plan", plan: next.plan } : { kind: "followup", parsed: next });
    });
  }

  /** The person corrected which needs we picked up; recount before asking more. */
  function changeNeeds(parsed: ParseResponse, needs: ResourceCategory[]) {
    run(async () => {
      const { situation, candidateCount } = await updateNeeds(parsed.situation, needs);
      setStep({ kind: "followup", parsed: { ...parsed, situation, candidateCount } });
    });
  }

  /** Rebuild the plan after the person adds a detail from the plan page. */
  function refinePlan(plan: Plan, answers: { field: AskableField; value: string }[]) {
    run(async () => {
      setStep({ kind: "plan", plan: await refinePlanAction(plan.situation, plan.parsedBy, answers, lang) });
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
          {t("app.headline")}
        </h1>
      )}
      {step.kind !== "input" && (
        <h2 className="text-xl sm:text-2xl font-medium text-accent-700 no-print" aria-live="polite">
          {t(`app.step.${step.kind}` as MessageKey)}
        </h2>
      )}
      {error && (
        <div role="alert" className="rounded-none border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {step.kind === "input" && (
        <SituationForm initialText={text} initialNeeds={pickedNeeds} pending={pending} aiEnabled={aiEnabled} onSubmit={submitSituation} />
      )}
      {(step.kind === "followup" || step.kind === "plan") && hasImmediateSafetyConcern(situationOf(step)) && <CrisisBanner />}
      {step.kind === "crisis" && (
        <CrisisSupport pending={pending} onContinue={() => continueFromCrisis(step.parsed)} onEdit={reset} />
      )}
      {step.kind === "followup" && (
        <FollowUpStep
          key={step.parsed.question?.field}
          parsed={step.parsed}
          pending={pending}
          onAnswer={(a) => submitAnswer(step.parsed, a)}
          onNeedsChange={(needs) => changeNeeds(step.parsed, needs)}
          onBack={reset}
        />
      )}
      {step.kind === "plan" && (
        <PlanView plan={step.plan} pending={pending} onRefine={(a) => refinePlan(step.plan, a)} onReset={reset} />
      )}
    </div>
  );
}

function situationOf(step: Step) {
  if (step.kind === "followup" || step.kind === "crisis") return step.parsed.situation;
  if (step.kind === "plan") return step.plan.situation;
  return {};
}
