"use client";

import { useState } from "react";
import type { BenefitSummary } from "@/lib/benefits/estimate";
import type { ReadyPacket } from "@/lib/plan/readyPacket";
import type { Plan } from "@/lib/types";
import { useFactChips } from "./FollowUpStep";
import { useLanguage } from "./LanguageProvider";
import { Button, Spinner } from "./ui";

export function ReportDownloadButton({ plan, benefits, packet }: { plan: Plan; benefits: BenefitSummary; packet: ReadyPacket }) {
  const { lang, t } = useLanguage();
  const facts = useFactChips(plan.situation);
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  async function download() {
    setState("working");
    try {
      // The PDF engine and fonts load only when someone asks for a report.
      const { renderReport } = await import("./report/ReportDocument");
      const blob = await renderReport({ plan, benefits, packet, facts, t, lang });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setState("idle");
    } catch (err) {
      console.error("[LifeLine] report.pdf failed", err);
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="primary" onClick={download} disabled={state === "working"}>
        {state === "working" ? (
          <Spinner />
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
          </svg>
        )}
        {state === "working" ? t("report.working") : t("report.download")}
      </Button>
      {state === "error" && (
        <span role="alert" className="text-xs text-red-700">
          {t("report.error")}
        </span>
      )}
    </div>
  );
}
