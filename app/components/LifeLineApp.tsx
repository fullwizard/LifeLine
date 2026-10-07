"use client";

import { useRef, useState, useTransition } from "react";
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
  const recount = useRef(0);

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

  /**
   * The person corrected which needs we picked up. Apply it immediately so the
   * chip responds on tap, then refresh the program count in the background;
   * only the latest request is allowed to land.
   */
  function changeNeeds(parsed: ParseResponse, needs: ResourceCategory[]) {
    const optimistic = { ...parsed, situation: { ...parsed.situation, needs } };
    setStep({ kind: "followup", parsed: optimistic });
    const id = ++recount.current;
    updateNeeds(parsed.situation, needs)
      .then(({ candidateCount }) => {
        if (id !== recount.current) return;
        setStep((current) =>
          current.kind === "followup" ? { kind: "followup", parsed: { ...current.parsed, candidateCount } } : current,
        );
      })
      .catch(() => {
        // The count is informational; keep the previous one on failure.
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

  const stage = step.kind === "input" ? 0 : step.kind === "plan" ? 2 : 1;

  return (
    <div>
      {step.kind === "input" ? (
        <div className="mx-auto max-w-2xl pt-6 pb-4 sm:pt-12">
          <p className="text-sm font-medium text-accent-700">{t("app.eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 text-balance sm:text-4xl">{t("app.headline")}</h1>
          <p className="mt-3 text-base leading-relaxed text-neutral-600 sm:text-lg">{t("app.sub")}</p>
        </div>
      ) : (
        <Stepper stage={stage} />
      )}

      {error && (
        <div role="alert" className="mx-auto mb-4 max-w-2xl rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {step.kind === "input" && (
        <div className="mx-auto max-w-2xl">
          <SituationForm initialText={text} initialNeeds={pickedNeeds} pending={pending} aiEnabled={aiEnabled} onSubmit={submitSituation} />
          <HowItWorks />
        </div>
      )}
      {(step.kind === "followup" || step.kind === "plan") && hasImmediateSafetyConcern(situationOf(step)) && (
        <div className="mb-6">
          <CrisisBanner />
        </div>
      )}
      {step.kind === "crisis" && (
        <div className="mx-auto max-w-2xl">
          <CrisisSupport pending={pending} onContinue={() => continueFromCrisis(step.parsed)} onEdit={reset} />
        </div>
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

/** Where the person is in the three-part flow. */
function Stepper({ stage }: { stage: number }) {
  const { t } = useLanguage();
  const labels: MessageKey[] = ["stepper.describe", "stepper.details", "stepper.plan"];
  return (
    <ol className="mb-6 flex items-center gap-2 text-sm no-print" aria-label={t("stepper.label")}>
      {labels.map((key, i) => (
        <li key={key} className="flex items-center gap-2" aria-current={i === stage ? "step" : undefined}>
          {i > 0 && <span className="h-px w-6 bg-neutral-300 sm:w-10" aria-hidden />}
          <span
            className={
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold " +
              (i < stage ? "bg-neutral-900 text-white" : i === stage ? "bg-accent-700 text-white" : "bg-neutral-200 text-neutral-500")
            }
          >
            {i < stage ? "✓" : i + 1}
          </span>
          <span className={i === stage ? "font-medium text-neutral-900" : "text-neutral-500"}>{t(key)}</span>
        </li>
      ))}
    </ol>
  );
}

function HowItWorks() {
  const { t } = useLanguage();
  const items: [MessageKey, MessageKey][] = [
    ["how.1.title", "how.1.body"],
    ["how.2.title", "how.2.body"],
    ["how.3.title", "how.3.body"],
  ];
  return (
    <ol className="mt-10 grid gap-6 border-t border-neutral-200 pt-8 sm:grid-cols-3">
      {items.map(([title, body], i) => (
        <li key={title}>
          <p className="text-xs font-semibold text-neutral-400 tabular-nums">0{i + 1}</p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">{t(title)}</p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-500">{t(body)}</p>
        </li>
      ))}
    </ol>
  );
}

function situationOf(step: Step) {
  if (step.kind === "followup" || step.kind === "crisis") return step.parsed.situation;
  if (step.kind === "plan") return step.plan.situation;
  return {};
}
