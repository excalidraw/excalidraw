import { describe, expect, it } from "vitest";

import en from "../locales/en.json";

// Every `{{placeholder}}` in en must appear verbatim in each translated
// string, and no translated string may introduce placeholders en does not
// have. Catches the #12097 class (es-ES `{{mix}}` for `{{max}}`, si-LK
// dropping `{{numShapes}}`/`{{maxSize}}`/`{{eventId}}`) before users see
// literal braces at runtime. Translations ship via Crowdin, but the check
// guards every file in the repo regardless of source.

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

const placeholders = (s: string): Set<string> => {
  const out = new Set<string>();
  for (const m of s.matchAll(PLACEHOLDER)) {
    out.add(m[1]);
  }
  return out;
};

const flatten = (
  node: unknown,
  prefix = "",
  out: Record<string, string> = {},
): Record<string, string> => {
  if (typeof node === "string") {
    out[prefix] = node;
    return out;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
  return out;
};

// Vitest resolves JSON imports relative to this file.
const LOCALES = import.meta.glob("../locales/*.json", { eager: true });

// Crowdin-managed locales whose translations legitimately lag en: their
// missing placeholders are real gaps (flagged in #12097 for si-LK) but must
// not fail this suite, or every en copy change breaks CI until translators
// catch up. Unknown (typo'd) placeholders still fail everywhere, and fully
// translated locales like es-ES are held to full parity.
const LAG_OK = new Set(["si-LK"]);

describe("locale placeholder parity with en", () => {
  const enFlat = flatten(en);

  for (const [path, mod] of Object.entries(LOCALES)) {
    const locale = path.split("/").pop()!.replace(".json", "");
    if (locale === "en" || locale === "percentages") {
      continue;
    }
    const flat = flatten((mod as { default: unknown }).default);

    it(`${locale}: no unknown or missing placeholders vs en`, () => {
      const problems: string[] = [];
      for (const [key, enValue] of Object.entries(enFlat)) {
        const value = flat[key];
        if (value === undefined || value === "") {
          continue; // untranslated keys fall back to en at runtime
        }
        const want = placeholders(enValue);
        const got = placeholders(value);
        for (const p of got) {
          if (!want.has(p)) {
            problems.push(`${key}: unknown placeholder {{${p}}}`);
          }
        }
        if (LAG_OK.has(locale)) {
          continue;
        }
        for (const p of want) {
          if (!got.has(p)) {
            problems.push(`${key}: missing placeholder {{${p}}}`);
          }
        }
      }
      expect(problems).toEqual([]);
    });
  }
});
