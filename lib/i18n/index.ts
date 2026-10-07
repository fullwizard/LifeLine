/**
 * Minimal, dependency-free translations. Pure: safe in server actions, client
 * components, and tests.
 *
 * English is the source of truth. Other languages may be partial; any missing
 * key falls back to English, so adding a language never breaks the app.
 * Strings use {name} placeholders.
 */
import { en, type MessageKey } from "./messages/en";
import { es } from "./messages/es";
import { vi } from "./messages/vi";
import { zhHans } from "./messages/zh-hans";
import { zhHant } from "./messages/zh-hant";

export const LANGS = ["en", "es", "vi", "zh-Hans", "zh-Hant"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  es: "Español",
  vi: "Tiếng Việt",
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
};

/** BCP-47 tag for <html lang> and number formatting. */
export const LANG_TAG: Record<Lang, string> = { en: "en-US", es: "es-US", vi: "vi-VN", "zh-Hans": "zh-Hans", "zh-Hant": "zh-Hant" };

const DICTS: Record<Lang, Partial<Record<MessageKey, string>>> = { en, es, vi, "zh-Hans": zhHans, "zh-Hant": zhHant };

export type Params = Record<string, string | number>;
export type T = (key: MessageKey, params?: Params) => string;
export type { MessageKey };

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

/**
 * Map a browser or stored language tag to one we support: "zh-CN"/"zh-SG" →
 * Simplified, "zh-TW"/"zh-HK"/"zh-MO" and the old stored "zh" → Traditional.
 */
export function matchLang(tag: string | null | undefined): Lang | undefined {
  if (!tag) return undefined;
  if (isLang(tag)) return tag;
  const t = tag.toLowerCase();
  if (t.startsWith("zh")) return /hans|cn|sg|my/.test(t) ? "zh-Hans" : "zh-Hant";
  const base = t.slice(0, 2);
  return isLang(base) ? base : undefined;
}

export function translate(lang: Lang, key: MessageKey, params?: Params): string {
  const template = DICTS[lang][key] ?? en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

export function translator(lang: Lang): T {
  return (key, params) => translate(lang, key, params);
}

export function formatMoney(n: number, lang: Lang = "en"): string {
  return `$${Math.round(n).toLocaleString(LANG_TAG[lang])}`;
}
