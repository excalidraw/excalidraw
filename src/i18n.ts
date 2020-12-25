import { EVENT_CHANGE, trackEvent } from "./analytics";

import fallbackLanguageData from "./locales/en.json";
import percentages from "./locales/percentages.json";

const COMPLETION_THRESHOLD = 85;

export interface Language {
  lng: string;
  label: string;
  rtl?: boolean;
}

const allLanguages: Language[] = [
  { lng: "ar-SA", label: "العربية", rtl: true },
  { lng: "bg-BG", label: "Български" },
  { lng: "ca-ES", label: "Catalan" },
  { lng: "de-DE", label: "Deutsch" },
  { lng: "el-GR", label: "Ελληνικά" },
  { lng: "es-ES", label: "Español" },
  { lng: "fa-IR", label: "فارسی", rtl: true },
  { lng: "fi-FI", label: "Suomi" },
  { lng: "fr-FR", label: "Français" },
  { lng: "he-IL", label: "עברית", rtl: true },
  { lng: "hi-IN", label: "हिन्दी" },
  { lng: "hu-HU", label: "Magyar" },
  { lng: "id-ID", label: "Bahasa Indonesia" },
  { lng: "it-IT", label: "Italiano" },
  { lng: "ja-JP", label: "日本語" },
  { lng: "ko-KR", label: "한국어" },
  { lng: "my-MM", label: "Burmese" },
  { lng: "nb-NO", label: "Norsk bokmål" },
  { lng: "nl-NL", label: "Nederlands" },
  { lng: "nn-NO", label: "Norsk nynorsk" },
  { lng: "pl-PL", label: "Polski" },
  { lng: "pt-BR", label: "Português Brasileiro" },
  { lng: "pt-PT", label: "Português" },
  { lng: "ro-RO", label: "Română" },
  { lng: "ru-RU", label: "Русский" },
  { lng: "sk-SK", label: "Slovenčina" },
  { lng: "sv-SE", label: "Svenska" },
  { lng: "tr-TR", label: "Türkçe" },
  { lng: "uk-UA", label: "Українська" },
  { lng: "zh-CN", label: "简体中文" },
  { lng: "zh-TW", label: "繁體中文" },
];

export const languages: Language[] = [{ lng: "en", label: "English" }]
  .concat(
    allLanguages.sort((left, right) => (left.label > right.label ? 1 : -1)),
  )
  .filter(
    (lang) =>
      (percentages as Record<string, number>)[lang.lng] >= COMPLETION_THRESHOLD,
  );

let currentLanguage = languages[0];
let currentLanguageData = {};

export const setLanguage = async (lang: Language) => {
  currentLanguage = lang;
  document.documentElement.dir = currentLanguage.rtl ? "rtl" : "ltr";

  currentLanguageData = await import(
    /* webpackChunkName: "i18n-[request]" */ `./locales/${currentLanguage.lng}.json`
  );
  trackEvent(EVENT_CHANGE, "language", currentLanguage.lng);
};

export const setLanguageFirstTime = async (lang: Language) => {
  currentLanguage = lang;
  document.documentElement.dir = currentLanguage.rtl ? "rtl" : "ltr";

  currentLanguageData = await import(
    /* webpackChunkName: "i18n-[request]" */ `./locales/${currentLanguage.lng}.json`
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
