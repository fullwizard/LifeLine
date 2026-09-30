"use client";

import { useState } from "react";
import type { MessageKey } from "@/lib/i18n";
import type { BreakdownItem, ScoredResource } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";

export function ResourceCard({ rank, scored, note }: { rank: number; scored: ScoredResource; note?: string }) {
  const { t } = useLanguage();
  const { resource, breakdown, needsVerification, score } = scored;
  const [open, setOpen] = useState(rank === 1);
  const unverified = breakdown.filter((b) => b.status === "unverified");

  return (
    <article id={`resource-${resource.id}`} className="rounded-none bg-paper p-5 sm:p-7 scroll-mt-24 target:ring-2 target:ring-accent-600 break-inside-avoid">
      <div className="flex items-start gap-4">
        <span className="shrink-0 font-sans font-semibold text-4xl leading-none text-accent-700">{rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-none bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
              {t(`category.${resource.category}` as MessageKey)}
            </span>
            {needsVerification ? (
              <span className="rounded-none bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                {unverified.length === 1 ? t("card.verify.one") : t("card.verify", { n: unverified.length })}
              </span>
            ) : (
              <span className="rounded-none bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">{t("card.allConfirmed")}</span>
            )}
          </div>
          <h3 className="mt-2 text-lg font-semibold leading-snug">{resource.name}</h3>
          <p className="text-sm text-neutral-500">{resource.organization}</p>
          <p className="mt-2 text-sm text-neutral-700 leading-relaxed">{note ?? resource.description}</p>
          <TrustLine verified={Boolean(resource.eligibility_verified)} date={resource.last_verified} />

          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <a
              href={resource.application_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-none bg-accent-700 px-3.5 py-1.5 font-medium text-white hover:bg-accent-800"
            >
              {t("card.apply")}
            </a>
            {resource.phone && (
              <a
                href={`tel:${resource.phone.replace(/[^0-9+]/g, "")}`}
                className="rounded-none border border-neutral-300 px-3.5 py-1.5 font-medium text-neutral-800 hover:bg-neutral-50"
              >
                {t("card.call", { phone: resource.phone })}
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-4 text-sm font-medium text-accent-700 hover:text-accent-900"
          >
            {t(open ? "card.hide" : "card.show", { rank, score })}
          </button>

          {open && (
            <ul className="mt-2 space-y-1 rounded-none bg-neutral-50">
              {breakdown.map((b) => (
                <li key={b.factor} className="flex gap-3 px-3 py-2 text-sm">
                  <StatusDot status={b.status} label={t(`status.${b.status}` as MessageKey)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-medium text-neutral-800">{t(`factor.${b.factor}` as MessageKey)}</span>
                      <span className="text-xs text-neutral-500">
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
                <a href={resource.source_url} target="_blank" rel="noopener noreferrer" className="underline">
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
      <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" focusable="false">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        {t("card.checked", { date })}
      </p>
    );
  }
  return <p className="mt-2 text-xs text-neutral-500">{t("card.unchecked")}</p>;
}

function StatusDot({ status, label }: { status: BreakdownItem["status"]; label: string }) {
  const color = status === "met" ? "bg-emerald-500" : status === "unverified" ? "bg-amber-500" : "bg-neutral-400";
  return <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${color}`} role="img" aria-label={label} />;
}
