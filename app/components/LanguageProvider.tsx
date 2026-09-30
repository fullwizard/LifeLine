"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { isLang, LANG_NAMES, LANG_TAG, LANGS, matchLang, translator, type Lang, type T } from "@/lib/i18n";

const STORAGE_KEY = "lifeline.lang";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: T;
}

const LanguageContext = createContext<LanguageContextValue>({ lang: "en", setLang: () => {}, t: translator("en") });

/** First visit: match the browser's language when we support it. */
function detectLang(): Lang {
  try {
    const saved = matchLang(window.localStorage.getItem(STORAGE_KEY));
    if (saved) return saved;
  } catch {
    // Storage can be blocked (private mode); fall through to the browser language.
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const match = matchLang(tag);
    if (match) return match;
  }
  return "en";
}

// The chosen language lives in localStorage (per browser, never sent anywhere).
// useSyncExternalStore reads it after hydration without a render-time mismatch.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let current: Lang | null = null;

function getSnapshot(): Lang {
  current ??= detectLang();
  return current;
}

function getServerSnapshot(): Lang {
  return "en";
}

function storeLang(next: Lang) {
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Not critical: the choice just won't be remembered.
  }
  listeners.forEach((l) => l());
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.lang = LANG_TAG[lang];
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang: storeLang, t: translator(lang) }), [lang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}

export function LanguagePicker() {
  const { lang, setLang, t } = useLanguage();
  return (
    <label className="language-picker">
      <span className="sr-only">{t("lang.label")}</span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.7 3.7 5.7 3.7 9s-1.2 6.3-3.7 9c-2.5-2.7-3.7-5.7-3.7-9S9.5 5.7 12 3Z" />
      </svg>
      <select value={lang} onChange={(e) => isLang(e.target.value) && setLang(e.target.value)} aria-label={t("lang.label")}>
        {LANGS.map((l) => (
          <option key={l} value={l} lang={LANG_TAG[l]}>
            {LANG_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
