"use client";

import { useState } from "react";
import type { BenefitSummary } from "@/lib/benefits/estimate";
import type { ReadyPacket } from "@/lib/plan/readyPacket";
import type { Plan } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";
import { canPrintInline, openBlob, printBlob, saveBlob } from "./report/pdfActions";

const FILE_NAME = "report.pdf";

export type ReportState = "idle" | "working" | "error";

export interface Report {
  state: ReportState;
  download: () => Promise<void>;
  print: () => Promise<void>;
}

/**
 * One report.pdf for the plan on screen. Download and Print both render the
 * same document, so what prints is exactly what downloads.
 */
export function useReport({ plan, benefits, packet, facts }: { plan: Plan; benefits: BenefitSummary; packet: ReadyPacket; facts: string[] }): Report {
  const { lang, t } = useLanguage();
  const [state, setState] = useState<ReportState>("idle");

  async function build(): Promise<Blob> {
    // The PDF engine and fonts load only when someone asks for a report.
    const { renderReport } = await import("./report/ReportDocument");
    return renderReport({ plan, benefits, packet, facts, t, lang });
  }

  async function download() {
    setState("working");
    try {
      saveBlob(await build(), FILE_NAME);
      setState("idle");
    } catch (err) {
      console.error("[LifeLine] report.pdf failed", err);
      setState("error");
    }
  }

  async function print() {
    setState("working");
    // Opened here, inside the click, so the browser doesn't block it as a pop-up.
    const inline = canPrintInline();
    const tab = inline ? null : window.open("", "_blank");
    if (tab) {
      tab.document.title = t("report.working");
      tab.document.body.textContent = t("report.working");
    }
    try {
      const blob = await build();
      if (inline) await printBlob(blob);
      else openBlob(blob, tab, FILE_NAME);
      setState("idle");
    } catch (err) {
      console.error("[LifeLine] printing report.pdf failed; printing the page instead", err);
      tab?.close();
      setState("idle");
      // Last resort when the PDF can't be made (for example, offline before the Chinese fonts load).
      window.print();
    }
  }

  return { state, download, print };
}
