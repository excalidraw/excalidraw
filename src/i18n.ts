import LanguageDetector from "i18next-browser-languagedetector";

import fallbackLanguageData from "./locales/en.json";
import percentages from "./locales/percentages.json";

const COMPLETION_THRESHOLD_TO_EXCEED = 85;

interface Language {
  lng: string;
  label: string;
  rtl?: boolean;
}

const allLanguages: Language[] = [
  { lng: "bg-BG", label: "Български" },
  { lng: "de-DE", label: "Deutsch" },
  { lng: "es-ES", label: "Español" },
  { lng: "ca-ES", label: "Catalan" },
  { lng: "el-GR", label: "Ελληνικά" },
  { lng: "fr-FR", label: "Français" },
  { lng: "id-ID", label: "Bahasa Indonesia" },
  { lng: "it-IT", label: "Italiano" },
  { lng: "hu-HU", label: "Magyar" },
  { lng: "nl-NL", label: "Nederlands" },
  { lng: "nb-NO", label: "Norsk bokmål" },
  { lng: "nn-NO", label: "Norsk nynorsk" },
  { lng: "pl-PL", label: "Polski" },
  { lng: "pt-PT", label: "Português" },
  { lng: "ru-RU", label: "Русский" },
  { lng: "uk-UA", label: "Українська" },
  { lng: "fi-FI", label: "Suomi" },
  { lng: "tr-TR", label: "Türkçe" },
  { lng: "ja-JP", label: "日本語" },
  { lng: "ko-KR", label: "한국어" },
  { lng: "zh-TW", label: "繁體中文" },
  { lng: "zh-CN", label: "简体中文" },
  { lng: "ar-SA", label: "العربية", rtl: true },
  { lng: "he-IL", label: "עברית", rtl: true },
  { lng: "hi-IN", label: "हिन्दी" },
  { lng: "ta-IN", label: "தமிழ்" },
  { lng: "gl-ES", label: "Galego" },
  { lng: "ro-RO", label: "Română" },
  { lng: "sv-SE", label: "Svenska" },
];

export const languages: Language[] = [{ lng: "en", label: "English" }]
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
  for (var i = 0; i < parts.length; ++i) {
    const part = parts[i];
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
    for (var key in replacement) {
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
