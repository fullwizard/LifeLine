"use client";

import { useLanguage } from "./LanguageProvider";
import type { Report } from "./useReport";
import { Button, Spinner } from "./ui";

export function ReportDownloadButton({ report }: { report: Report }) {
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-2">
      <Button variant="primary" onClick={report.download} disabled={report.state === "working"}>
        {report.state === "working" ? (
          <Spinner />
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
          </svg>
        )}
        {report.state === "working" ? t("report.working") : t("report.download")}
      </Button>
      {report.state === "error" && (
        <span role="alert" className="text-xs text-red-700">
          {t("report.error")}
        </span>
      )}
    </div>
  );
}
