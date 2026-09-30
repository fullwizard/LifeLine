import { describe, expect, it } from "vitest";
import { formatMoney, translate } from ".";
import { en } from "./messages/en";
import { es } from "./messages/es";
import { vi } from "./messages/vi";
import { zh } from "./messages/zh";

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

describe("translations", () => {
  for (const [lang, dict] of Object.entries({ es, vi, zh })) {
    it(`${lang} has every key with the same placeholders`, () => {
      for (const [key, source] of Object.entries(en)) {
        const text = (dict as Record<string, string>)[key];
        expect(text, `${lang}: ${key}`).toBeTruthy();
        expect(placeholders(text), `${lang}: ${key}`).toEqual(placeholders(source));
      }
    });
  }

  it("fills placeholders and falls back to English", () => {
    expect(translate("en", "facts.household", { n: 4 })).toBe("Household of 4");
    expect(translate("es", "facts.household", { n: 4 })).toContain("4");
    expect(formatMoney(1234.4)).toBe("$1,234");
  });
});
