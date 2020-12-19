import LanguageDetector from "i18next-browser-languagedetector";
import { EVENT_CHANGE, trackEvent } from "./analytics";

import fallbackLanguageData from "./locales/en.json";
import percentages from "./locales/percentages.json";

const COMPLETION_THRESHOLD_TO_EXCEED = 85;

export interface Language {
  lng: string;
  label: string;
  emoji: string;
  rtl?: boolean;
}

const allLanguages: Language[] = [
  { lng: "ar-SA", emoji: "🇸🇦", label: "العربية", rtl: true },
  { lng: "bg-BG", emoji: "🇧🇬", label: "Български" },
  { lng: "ca-ES", emoji: "🇪🇸", label: "Catalan" },
  { lng: "de-DE", emoji: "🇩🇪", label: "Deutsch" },
  { lng: "el-GR", emoji: "🇬🇷", label: "Ελληνικά" },
  { lng: "es-ES", emoji: "🇪🇸", label: "Español" },
  { lng: "fa-IR", emoji: "🇮🇷", label: "فارسی", rtl: true },
  { lng: "fi-FI", emoji: "🇫🇮", label: "Suomi" },
  { lng: "fr-FR", emoji: "🇫🇷", label: "Français" },
  { lng: "he-IL", emoji: "🇮🇱", label: "עברית", rtl: true },
  { lng: "hi-IN", emoji: "🇮🇳", label: "हिन्दी" },
  { lng: "hu-HU", emoji: "🇭🇺", label: "Magyar" },
  { lng: "id-ID", emoji: "🇮🇩", label: "Bahasa Indonesia" },
  { lng: "it-IT", emoji: "🇮🇹", label: "Italiano" },
  { lng: "ja-JP", emoji: "🇯🇵", label: "日本語" },
  { lng: "ko-KR", emoji: "🇰🇷", label: "한국어" },
  { lng: "my-MM", emoji: "🇲🇲", label: "Burmese" },
  { lng: "nb-NO", emoji: "🇳🇴", label: "Norsk bokmål" },
  { lng: "nl-NL", emoji: "🇳🇱", label: "Nederlands" },
  { lng: "nn-NO", emoji: "🇳🇴", label: "Norsk nynorsk" },
  { lng: "pl-PL", emoji: "🇵🇱", label: "Polski" },
  { lng: "pt-PT", emoji: "🇵🇹", label: "Português" },
  { lng: "ro-RO", emoji: "🇷🇴", label: "Română" },
  { lng: "ru-RU", emoji: "🇷🇺", label: "Русский" },
  { lng: "sk-SK", emoji: "🇸🇰", label: "Slovenčina" },
  { lng: "sv-SE", emoji: "🇸🇪", label: "Svenska" },
  { lng: "tr-TR", emoji: "🇹🇷", label: "Türkçe" },
  { lng: "uk-UA", emoji: "🇺🇦", label: "Українська" },
  { lng: "zh-CN", emoji: "🇨🇳", label: "简体中文" },
  { lng: "zh-TW", emoji: "🇹🇼", label: "繁體中文" },
];

export const languages: Language[] = [
  { lng: "en", emoji: "🇬🇧", label: "English" },
]
  .concat(
    allLanguages.sort((left, right) => (left.label > right.label ? 1 : -1)),
  )
  .filter(
    (lang) =>
      (percentages as Record<string, number>)[lang.lng] >
      COMPLETION_THRESHOLD_TO_EXCEED,
  );

let currentLanguage = languages[0];
let currentLanguageData = {};
const fallbackLanguage = languages[0];

export const setLanguage = async (newLng: string | undefined) => {
  currentLanguage =
    languages.find((language) => language.lng === newLng) || fallbackLanguage;

  document.documentElement.dir = currentLanguage.rtl ? "rtl" : "ltr";

  currentLanguageData = await import(
    /* webpackChunkName: "i18n-[request]" */ `./locales/${currentLanguage.lng}.json`
  );
  languageDetector.cacheUserLanguage(currentLanguage.lng);
  trackEvent(EVENT_CHANGE, "language", currentLanguage.lng);
};

export const setLanguageFirstTime = async () => {
  const newLng: string | undefined = languageDetector.detect();

  currentLanguage =
    languages.find((language) => language.lng === newLng) || fallbackLanguage;

  document.documentElement.dir = currentLanguage.rtl ? "rtl" : "ltr";

  currentLanguageData = await import(
    /* webpackChunkName: "i18n-[request]" */ `./locales/${currentLanguage.lng}.json`
  );

  languageDetector.cacheUserLanguage(currentLanguage.lng);
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

const languageDetector = new LanguageDetector();
languageDetector.init({
  languageUtils: {
    formatLanguageCode: (lng: string) => lng,
    isWhitelisted: () => true,
  },
  checkWhitelist: false,
});
