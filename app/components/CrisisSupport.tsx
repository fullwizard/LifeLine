"use client";

import { useLanguage } from "./LanguageProvider";

export function CrisisSupport({
  pending,
  onContinue,
  onEdit,
}: {
  pending: boolean;
  onContinue: () => void;
  onEdit: () => void;
}) {
  const { t } = useLanguage();
  return (
    <section
      role="alert"
      className="rounded-lg border border-red-300 bg-red-50 p-5 text-red-950 sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-red-700">{t("crisis.kicker")}</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">{t("crisis.title")}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed">
        {t("crisis.body")}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <a
          href="tel:988"
          className="inline-flex h-10 items-center rounded-md bg-red-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-red-800"
        >
          {t("crisis.call")}
        </a>
        <a
          href="https://988lifeline.org/get-help/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center rounded-md border border-red-300 bg-white px-5 text-sm font-medium text-red-800 transition-colors hover:bg-red-100"
        >
          {t("crisis.more")}
        </a>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
        <button
          type="button"
          onClick={onContinue}
          disabled={pending}
          className="font-medium text-red-800 underline underline-offset-4 hover:text-red-950 disabled:text-red-300"
        >
          {pending ? t("crisis.continuing") : t("crisis.continue")}
        </button>
        <button type="button" onClick={onEdit} disabled={pending} className="text-red-700 hover:text-red-950 disabled:text-red-300">
          {t("crisis.edit")}
        </button>
      </div>
    </section>
  );
}

/** Compact reminder shown on later steps once a safety concern was detected. */
export function CrisisBanner() {
  const { t } = useLanguage();
  return (
    <div
      role="note"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950"
    >
      <span>{t("crisis.banner")}</span>
      <a href="tel:988" className="inline-flex h-8 items-center rounded-md bg-red-700 px-3 font-semibold text-white hover:bg-red-800">
        {t("crisis.call")}
      </a>
    </div>
  );
}
