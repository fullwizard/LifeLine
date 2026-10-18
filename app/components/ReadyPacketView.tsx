"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { MessageKey } from "@/lib/i18n";
import type { ReadyPacket, StepWhen } from "@/lib/plan/readyPacket";
import { mailtoLink, smsLink, WINDOWS_MAILTO_LIMIT } from "@/lib/share/shareLinks";
import { useLanguage } from "./LanguageProvider";
import { Badge, Button, ButtonLink, Card, PhoneLink, SectionHeader } from "./ui";

const WHEN_TONE: Record<StepWhen, "danger" | "accent" | "neutral"> = {
  now: "danger",
  today: "accent",
  week: "neutral",
  next: "neutral",
};

export function ReadyPacketView({ packet, onPrint, printing }: { packet: ReadyPacket; onPrint: () => void; printing: boolean }) {
  const { t } = useLanguage();

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <section aria-labelledby="steps-title">
        <SectionHeader title={<span id="steps-title">{t("packet.steps")}</span>} />
        <ol className="mt-4">
          {packet.steps.map((s, i) => (
            <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
              {i < packet.steps.length - 1 && <span className="absolute left-[13px] top-7 bottom-0 w-px bg-neutral-200" aria-hidden />}
              <span className="relative flex h-7 w-7 shrink-0 items-center justify-center border border-neutral-900 bg-paper text-xs font-semibold text-neutral-900 tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <Badge tone={WHEN_TONE[s.when]}>{t(`when.${s.when}` as MessageKey)}</Badge>
                <p className="mt-1.5 text-sm font-medium leading-relaxed text-neutral-900">{s.text}</p>
                {s.detail && <p className="mt-1 text-sm leading-relaxed text-neutral-600">{s.detail}</p>}
                {(s.phone || s.link) && (
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {s.phone && <PhoneLink phone={s.phone} />}
                    {s.link && (
                      <a href={s.link.url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-700 hover:underline">
                        {s.link.label} ↗
                      </a>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="space-y-8">
        {packet.documents.length > 0 && (
          <section aria-labelledby="docs-title">
            <SectionHeader title={<span id="docs-title">{t("packet.docs")}</span>} />
            <Card className="mt-4 divide-y divide-neutral-200">
              {packet.documents.map((d) => (
                <label key={d.key} className="flex cursor-pointer gap-3 px-4 py-3 hover:bg-neutral-50">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded-none accent-accent-700" />
                  <span className="min-w-0 text-sm">
                    <span className="block font-medium text-neutral-900">{d.label}</span>
                    {d.tip && <span className="mt-0.5 block text-xs leading-relaxed text-neutral-600">{d.tip}</span>}
                    <span className="mt-0.5 block text-xs text-neutral-400">{t("packet.docs.for", { list: d.forWhat.join(", ") })}</span>
                  </span>
                </label>
              ))}
            </Card>
          </section>
        )}
        <ShareBar text={packet.shareText} onPrint={onPrint} printing={printing} />
      </div>

      {packet.calls.length > 0 && (
        <section aria-labelledby="calls-title" className="lg:col-span-2">
          <SectionHeader title={<span id="calls-title">{t("packet.calls")}</span>} />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {packet.calls.map((c, i) => (
              <Card key={c.resourceId} className="overflow-hidden">
                <details open={i === 0} className="group">
                  <summary className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-neutral-900">{c.name}</span>
                      {c.phone && <span className="block text-xs text-neutral-500 tabular-nums">{c.phone}</span>}
                    </span>
                    <svg className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </summary>
                  <div className="space-y-3 border-t border-neutral-200 px-4 py-4 text-sm">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t("packet.say")}</p>
                      <blockquote className="mt-1 border-l-2 border-accent-200 pl-3 leading-relaxed text-neutral-800">{c.opener}</blockquote>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t("packet.ask")}</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-neutral-700 marker:text-neutral-300">
                        {c.questions.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                    </div>
                    {c.phone ? (
                      <ButtonLink href={`tel:${c.phone.replace(/[^0-9+]/g, "")}`} variant="primary" size="sm" className="no-print">
                        {t("card.call", { phone: c.phone })}
                      </ButtonLink>
                    ) : (
                      <ButtonLink href={c.url} external size="sm" className="no-print">
                        {t("step.visit.link")} ↗
                      </ButtonLink>
                    )}
                  </div>
                </details>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const noSubscription = () => () => {};

/** Browser-only value that is `false` on the server and during hydration, so markup matches. */
function useIsWindows(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => /Windows/i.test(navigator.userAgent),
    () => false,
  );
}

/**
 * A browser gives no signal when a sms:/mailto: link has no app to open. When
 * one does open, the page loses focus or is hidden almost at once, so silence
 * for a moment means nothing opened (a desktop or shared computer with no mail
 * program). Call `watch()` from the link's click handler.
 */
function useNothingOpened(): { nothingOpened: boolean; watch: () => void; clear: () => void } {
  const [nothingOpened, setNothingOpened] = useState(false);
  const stopWatching = useRef<() => void>(() => {});
  useEffect(() => () => stopWatching.current(), []);

  function watch() {
    stopWatching.current();
    setNothingOpened(false);
    const stop = () => {
      window.clearTimeout(timer);
      window.removeEventListener("blur", stop);
      window.removeEventListener("pagehide", stop);
      document.removeEventListener("visibilitychange", stop);
    };
    const timer = window.setTimeout(() => {
      stop();
      setNothingOpened(true);
    }, 1500);
    window.addEventListener("blur", stop);
    window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", stop);
    stopWatching.current = stop;
  }

  return { nothingOpened, watch, clear: () => setNothingOpened(false) };
}

function ShareBar({ text, onPrint, printing }: { text: string; onPrint: () => void; printing: boolean }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const { nothingOpened, watch, clear } = useNothingOpened();
  const windows = useIsWindows();

  // Windows mail clients refuse very long links; elsewhere the full plan goes through.
  const email = mailtoLink(t("share.title"), text, windows ? { maxLength: WINDOWS_MAILTO_LIMIT, truncatedNote: t("packet.truncated") } : {});

  async function copy() {
    clear();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="no-print" aria-label={t("packet.share")}>
      <p className="text-sm font-medium text-neutral-900">{t("packet.share")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {/* sms: and mailto: open the person's own apps; nothing passes through LifeLine. */}
        <ButtonLink href={smsLink(text)} size="sm" onClick={watch}>
          {t("packet.text")}
        </ButtonLink>
        <ButtonLink href={email} size="sm" onClick={watch}>
          {t("packet.email")}
        </ButtonLink>
        <Button size="sm" onClick={copy} aria-live="polite">
          {copied ? t("packet.copied") : t("packet.copy")}
        </Button>
        <Button size="sm" onClick={onPrint} disabled={printing}>
          {printing ? t("report.working") : t("packet.print")}
        </Button>
      </div>
      {nothingOpened && (
        <p role="status" className="mt-2 text-xs leading-relaxed text-neutral-700">
          {t("packet.noApp")}
        </p>
      )}
    </section>
  );
}
