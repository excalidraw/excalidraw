import LanguageDetector from "i18next-browser-languagedetector";

import fallbackLanguageData from "./locales/en.json";

export const languages = [
  { lng: "en", label: "English", data: "en.json" },
  { lng: "bg-BG", label: "Български", data: "bg-BG.json" },
  { lng: "de-DE", label: "Deutsch", data: "de-DE.json" },
  { lng: "nb-No", label: "Bokmål", data: "nb-NO.json" },
  { lng: "es-ES", label: "Español", data: "es-ES.json" },
  { lng: "ca-ES", label: "Catalan", data: "ca-ES.json" },
  { lng: "el-GR", label: "Ελληνικά", data: "el-GR.json" },
  { lng: "fr-FR", label: "Français", data: "fr-FR.json" },
  { lng: "id-ID", label: "Bahasa Indonesia", data: "id-ID.json" },
  { lng: "it-IT", label: "Italiano", data: "it-IT.json" },
  { lng: "hu-HU", label: "Magyar", data: "hu-HU.json" },
  { lng: "nl-NL", label: "Nederlands", data: "nl-NL.json" },
  { lng: "pl-PL", label: "Polski", data: "pl-PL.json" },
  { lng: "pt-PT", label: "Português", data: "pt-PT.json" },
  { lng: "ru-RU", label: "Русский", data: "ru-RU.json" },
  { lng: "uk-UA", label: "Українська", data: "uk-UA.json" },
  { lng: "fi-FI", label: "Suomi", data: "fi-FI.json" },
  { lng: "tr-TR", label: "Türkçe", data: "tr-TR.json" },
  { lng: "ja-JP", label: "日本語", data: "ja-JP.json" },
  { lng: "ko-KR", label: "한국어", data: "ko-KR.json" },
  { lng: "zh-TW", label: "繁體中文", data: "zh-TW.json" },
  { lng: "zh-CN", label: "简体中文", data: "zh-CN.json" },
  { lng: "ar-SA", label: "العربية", data: "ar-SA.json", rtl: true },
  { lng: "he-IL", label: "עברית", data: "he-IL.json", rtl: true },
];

let currentLanguage = languages[0];
let currentLanguageData = {};
const fallbackLanguage = languages[0];

export const setLanguage = async (newLng: string | undefined) => {
  currentLanguage =
    languages.find((language) => language.lng === newLng) || fallbackLanguage;

  document.documentElement.dir = currentLanguage.rtl ? "rtl" : "ltr";

  currentLanguageData = await import(`./locales/${currentLanguage.data}`);

  languageDetector.cacheUserLanguage(currentLanguage.lng);
};

export const setLanguageFirstTime = async () => {
  const newLng: string | undefined = languageDetector.detect();

  currentLanguage =
    languages.find((language) => language.lng === newLng) || fallbackLanguage;

  document.documentElement.dir = currentLanguage.rtl ? "rtl" : "ltr";

  currentLanguageData = await import(`./locales/${currentLanguage.data}`);

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
