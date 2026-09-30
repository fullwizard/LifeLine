import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { ReportDocument, registerFonts } from "@/app/components/report/ReportDocument";
import { estimateBenefits } from "./benefits/estimate";
import { parseSituationByKeywords } from "./gemini/fallback/keywordParser";
import { translator, type Lang } from "./i18n";
import { buildPlan } from "./plan/buildPlan";
import { buildReadyPacket } from "./plan/readyPacket";

describe("report.pdf", () => {
  // Latin-script languages only: the Chinese fonts load from a CDN.
  for (const lang of ["en", "vi"] as Lang[]) {
    it(`renders a ${lang} report`, async () => {
      registerFonts(`${process.cwd()}/public`);
      const t = translator(lang);
      const situation = parseSituationByKeywords("I live in San Jose with two kids. Got an eviction notice. I make $2,400 a month, rent is $2,100.");
      const plan = await buildPlan(situation, "fallback", lang);
      const benefits = estimateBenefits(plan.situation, t, lang);
      const packet = buildReadyPacket(plan, benefits, t, lang);
      const element = createElement(ReportDocument, { plan, benefits, packet, facts: ["San Jose"], t, lang });
      const buf = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
      expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(buf.length).toBeGreaterThan(10_000);
    }, 30_000);
  }
});
