"use client";

import { useState } from "react";
import type { MessageKey } from "@/lib/i18n";
import { isEligibilityUnverified } from "@/lib/matching/score";
import type { BreakdownItem, ScoredResource } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";
import { Badge, Button, ButtonLink } from "./ui";

export function ResourceCard({ rank, scored, note }: { rank: number; scored: ScoredResource; note?: string }) {
  const { t } = useLanguage();
  const { resource, breakdown, needsVerification } = scored;
  const [open, setOpen] = useState(false);
  const unverified = breakdown.filter(isEligibilityUnverified);

  return (
    <article id={`resource-${resource.id}`} className="scroll-mt-6 border-b border-neutral-300 py-5 target:border-l-4 target:border-l-accent-700 target:pl-4 sm:py-6">
      <div className="flex items-start gap-4">
        <span className="w-8 shrink-0 text-3xl font-bold leading-none tracking-tight text-accent-700 tabular-nums">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <h3 className="font-semibold leading-snug text-neutral-900">{resource.name}</h3>
              <p className="text-sm text-neutral-500">
                {resource.organization} · {t(`category.${resource.category}` as MessageKey)}
              </p>
            </div>
            {needsVerification ? (
              <Badge tone="warning">{unverified.length === 1 ? t("card.verify.one") : t("card.verify", { n: unverified.length })}</Badge>
            ) : (
              <Badge tone="success">{t("card.allConfirmed")}</Badge>
            )}
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-700">{concise(note ?? resource.description)}</p>
          <TrustLine verified={Boolean(resource.eligibility_verified)} date={resource.last_verified} />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ButtonLink href={resource.application_url} external variant="primary" size="sm">
              {t("card.apply")} ↗
            </ButtonLink>
            {resource.phone && (
              <ButtonLink href={`tel:${resource.phone.replace(/[^0-9+]/g, "")}`} size="sm">
                {t("card.call", { phone: resource.phone })}
              </ButtonLink>
            )}
            <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="no-print">
              {t(open ? "card.hide" : "card.show")}
            </Button>
          </div>

          {open && (
            <ul className="mt-4 divide-y divide-neutral-300 border-l-2 border-neutral-950 bg-neutral-50">
              {breakdown.map((b) => (
                <li key={b.factor} className="flex gap-3 px-3 py-2 text-sm">
                  <StatusDot status={b.status} label={t(`status.${b.status}` as MessageKey)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-medium text-neutral-800">{t(`factor.${b.factor}` as MessageKey)}</span>
                      <span className="text-xs text-neutral-500 tabular-nums">
                        {t(`status.${b.status}` as MessageKey)}
                        {b.points > 0 ? ` · +${b.points}` : ""}
                      </span>
                    </div>
                    <p className="text-neutral-600">{b.detail}</p>
                  </div>
                </li>
              ))}
              {resource.required_documents.length > 0 && (
                <li className="px-3 py-2 text-xs text-neutral-500">{t("card.bring", { list: resource.required_documents.join(", ") })}</li>
              )}
              <li className="px-3 py-2 text-xs text-neutral-500">
                {t("card.source")}{" "}
                <a href={resource.source_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-neutral-800">
                  {new URL(resource.source_url).hostname}
                </a>
              </li>
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}

function TrustLine({ verified, date }: { verified: boolean; date?: string }) {
  const { t } = useLanguage();
  if (verified && date) {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" focusable="false">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        {t("card.checked", { date })}
      </p>
    );
  }
  return null;
}

function StatusDot({ status, label }: { status: BreakdownItem["status"]; label: string }) {
  const color = status === "met" ? "bg-neutral-950" : status === "unverified" ? "bg-signal" : "bg-neutral-300";
  return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${color}`} role="img" aria-label={label} />;
}

function concise(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  const sentences = text.match(/[^.!?]+[.!?]+/g)?.slice(0, 2).join(" ").trim();
  const candidate = sentences && sentences.length >= 45 ? sentences : text;
  if (candidate.length <= 260) return candidate;
  return `${candidate.slice(0, 257).replace(/\s+\S*$/, "")}…`;
}
