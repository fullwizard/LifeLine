"use client";

import { useState } from "react";
import type { MessageKey } from "@/lib/i18n";
import type { ReadyPacket, StepWhen } from "@/lib/plan/readyPacket";
import { useLanguage } from "./LanguageProvider";

const WHEN_STYLE: Record<StepWhen, string> = {
  now: "bg-red-700 text-white",
  today: "bg-accent-700 text-white",
  week: "bg-neutral-200 text-neutral-900",
  next: "bg-neutral-100 text-neutral-700",
};

export function ReadyPacketView({ packet }: { packet: ReadyPacket }) {
  const { t } = useLanguage();

  return (
    <section id="ready" aria-labelledby="ready-title" className="scroll-mt-20 rounded-none bg-paper p-5 sm:p-7 print-break">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="ready-title" className="text-xl font-semibold text-neutral-900">
            {t("packet.title")}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">{t("packet.sub")}</p>
        </div>
        <ShareBar text={packet.shareText} />
      </div>

      <h3 className="mt-6 text-base font-semibold text-neutral-900">{t("packet.steps")}</h3>
      <ol className="mt-3 space-y-3">
        {packet.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 shrink-0 font-semibold text-accent-700 tabular-nums">{i + 1}.</span>
            <div className="min-w-0">
              <span className={`mr-2 inline-block rounded-none px-2 py-0.5 text-xs font-semibold ${WHEN_STYLE[s.when]}`}>
                {t(`when.${s.when}` as MessageKey)}
              </span>
              <span className="text-neutral-900">{s.text}</span>
              {s.detail && <p className="mt-1 text-sm text-neutral-600">{s.detail}</p>}
              <div className="mt-1 flex flex-wrap gap-3 text-sm">
                {s.phone && (
                  <a href={`tel:${s.phone.replace(/[^0-9+]/g, "")}`} className="font-medium text-accent-700 underline underline-offset-4">
                    {s.phone}
                  </a>
                )}
                {s.link && (
                  <a href={s.link.url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-700 underline underline-offset-4">
                    {s.link.label}
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {packet.documents.length > 0 && (
        <>
          <h3 className="mt-8 text-base font-semibold text-neutral-900">{t("packet.docs")}</h3>
          <p className="text-sm text-neutral-600">{t("packet.docs.sub")}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {packet.documents.map((d) => (
              <li key={d.key} className="break-inside-avoid">
                <label className="flex cursor-pointer gap-3 rounded-none border border-neutral-200 bg-neutral-50 p-3">
                  <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-accent-700" />
                  <span className="min-w-0">
                    <span className="block font-medium text-neutral-900">{d.label}</span>
                    {d.tip && <span className="block text-xs text-neutral-600">{d.tip}</span>}
                    <span className="block text-xs text-neutral-500">{t("packet.docs.for", { list: d.forWhat.join(", ") })}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      {packet.calls.length > 0 && (
        <>
          <h3 className="mt-8 text-base font-semibold text-neutral-900">{t("packet.calls")}</h3>
          <div className="mt-3 space-y-3">
            {packet.calls.map((c, i) => (
              <details key={c.resourceId} open={i === 0} className="rounded-none border border-neutral-200 bg-neutral-50 p-4 break-inside-avoid">
                <summary className="cursor-pointer font-medium text-neutral-900">
                  {c.name}
                  {c.phone && <span className="ml-2 font-normal text-neutral-600">{c.phone}</span>}
                </summary>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-accent-700">{t("packet.say")}</p>
                <p className="mt-1 rounded-none bg-paper p-3 text-sm leading-relaxed text-neutral-900">“{c.opener}”</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-accent-700">{t("packet.ask")}</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-800">
                  {c.questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
                {c.phone && (
                  <a
                    href={`tel:${c.phone.replace(/[^0-9+]/g, "")}`}
                    className="mt-3 inline-block rounded-none bg-accent-700 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-accent-800 no-print"
                  >
                    {t("card.call", { phone: c.phone })}
                  </a>
                )}
              </details>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ShareBar({ text }: { text: string }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const smsBody = encodeURIComponent(text);
  const mailSubject = encodeURIComponent(t("share.title"));

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const btn = "rounded-none border border-neutral-300 bg-paper px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50";
  return (
    <div className="no-print">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => window.print()} className={btn}>
          {t("packet.print")}
        </button>
        <button type="button" onClick={copy} className={btn} aria-live="polite">
          {copied ? t("packet.copied") : t("packet.copy")}
        </button>
        {/* sms: and mailto: open the person's own apps; nothing passes through LifeLine. */}
        <a href={`sms:?&body=${smsBody}`} className={btn}>
          {t("packet.text")}
        </a>
        <a href={`mailto:?subject=${mailSubject}&body=${smsBody}`} className={btn}>
          {t("packet.email")}
        </a>
      </div>
      <p className="mt-1 max-w-xs text-xs text-neutral-500">{t("packet.shareNote")}</p>
    </div>
  );
}
