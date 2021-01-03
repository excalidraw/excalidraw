import { EVENT_CHANGE, trackEvent } from "./analytics";

import fallbackLanguageData from "./locales/en.json";
import percentages from "./locales/percentages.json";

const COMPLETION_THRESHOLD = 85;

export interface Language {
  code: string;
  label: string;
  rtl?: boolean;
}

const allLanguages: Language[] = [
  { code: "ar-SA", label: "العربية", rtl: true },
  { code: "bg-BG", label: "Български" },
  { code: "ca-ES", label: "Catalan" },
  { code: "de-DE", label: "Deutsch" },
  { code: "el-GR", label: "Ελληνικά" },
  { code: "es-ES", label: "Español" },
  { code: "fa-IR", label: "فارسی", rtl: true },
  { code: "fi-FI", label: "Suomi" },
  { code: "fr-FR", label: "Français" },
  { code: "he-IL", label: "עברית", rtl: true },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "hu-HU", label: "Magyar" },
  { code: "id-ID", label: "Bahasa Indonesia" },
  { code: "it-IT", label: "Italiano" },
  { code: "ja-JP", label: "日本語" },
  { code: "ko-KR", label: "한국어" },
  { code: "my-MM", label: "Burmese" },
  { code: "nb-NO", label: "Norsk bokmål" },
  { code: "nl-NL", label: "Nederlands" },
  { code: "nn-NO", label: "Norsk nynorsk" },
  { code: "pl-PL", label: "Polski" },
  { code: "pt-BR", label: "Português Brasileiro" },
  { code: "pt-PT", label: "Português" },
  { code: "ro-RO", label: "Română" },
  { code: "ru-RU", label: "Русский" },
  { code: "sk-SK", label: "Slovenčina" },
  { code: "sv-SE", label: "Svenska" },
  { code: "tr-TR", label: "Türkçe" },
  { code: "uk-UA", label: "Українська" },
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
];

export const defaultLang = { code: "en", label: "English" };

export const languages: Language[] = [defaultLang]
  .concat(
    allLanguages.sort((left, right) => (left.label > right.label ? 1 : -1)),
  )
  .filter(
    (lang) =>
      (percentages as Record<string, number>)[lang.code] >=
      COMPLETION_THRESHOLD,
  );

let currentLanguage: Language = defaultLang;
let currentLanguageData = {};

export const setLanguage = async (lang: Language) => {
  currentLanguage = lang;
  document.documentElement.dir = currentLanguage.rtl ? "rtl" : "ltr";

  currentLanguageData = await import(
    /* webpackChunkName: "i18n-[request]" */ `./locales/${currentLanguage.code}.json`
  );
  trackEvent(EVENT_CHANGE, "language", currentLanguage.code);
};

export const setLanguageFirstTime = async (lang: Language) => {
  currentLanguage = lang;
  document.documentElement.dir = currentLanguage.rtl ? "rtl" : "ltr";

  currentLanguageData = await import(
    /* webpackChunkName: "i18n-[request]" */ `./locales/${currentLanguage.code}.json`
  );
};

export const getLanguage = () => currentLanguage;

const findPartsForData = (data: any, parts: string[]) => {
  for (let index = 0; index < parts.length; ++index) {
    const part = parts[index];
    if (data[part] === undefined) {
      return undefined;
    }
    data = data[part];
  }
  if (typeof data !== "string") {
    return undefined;
  }
  return data;
};

export const t = (path: string, replacement?: { [key: string]: string }) => {
  const parts = path.split(".");
  let translation =
    findPartsForData(currentLanguageData, parts) ||
    findPartsForData(fallbackLanguageData, parts);
  if (translation === undefined) {
    throw new Error(`Can't find translation for ${path}`);
  }

  if (replacement) {
    for (const key in replacement) {
      translation = translation.replace(`{{${key}}}`, replacement[key]);
    }
  }
  return translation;
};
