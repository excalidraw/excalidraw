import LanguageDetector from "i18next-browser-languagedetector";

export const languages = [
  { lng: "en", label: "English", data: require("./locales/en.json") },
  { lng: "bg-BG", label: "Български", data: require("./locales/bg-BG.json") },
  { lng: "de-DE", label: "Deutsch", data: require("./locales/de-DE.json") },
  { lng: "es-ES", label: "Español", data: require("./locales/es-ES.json") },
  { lng: "el-GR", label: "Ελληνικά", data: require("./locales/el-GR.json") },
  { lng: "fr-FR", label: "Français", data: require("./locales/fr-FR.json") },
  {
    lng: "id-ID",
    label: "Bahasa Indonesia",
    data: require("./locales/id-ID.json"),
  },
  { lng: "it-IT", label: "Italiano", data: require("./locales/it-IT.json") },
  { lng: "hu-HU", label: "Magyar", data: require("./locales/hu-HU.json") },
  { lng: "nl-NL", label: "Nederlands", data: require("./locales/nl-NL.json") },
  { lng: "no-No", label: "Norsk", data: require("./locales/no-NO.json") },
  { lng: "pl-PL", label: "Polski", data: require("./locales/pl-PL.json") },
  { lng: "pt-PT", label: "Português", data: require("./locales/pt-PT.json") },
  { lng: "ru-RU", label: "Русский", data: require("./locales/ru-RU.json") },
  { lng: "fi-FI", label: "Suomi", data: require("./locales/fi-FI.json") },
  { lng: "tr-TR", label: "Türkçe", data: require("./locales/tr-TR.json") },
  { lng: "ja-JP", label: "日本語", data: require("./locales/ja-JP.json") },
  { lng: "ko-KR", label: "한국어", data: require("./locales/ko-KR.json") },
  { lng: "zh-TW", label: "繁體中文", data: require("./locales/zh-TW.json") },
  { lng: "zh-CN", label: "简体中文", data: require("./locales/zh-CN.json") },
  {
    lng: "ar-SA",
    label: "العربية",
    data: require("./locales/ar-SA.json"),
    rtl: true,
  },
  {
    lng: "he-IL",
    label: "עברית",
    data: require("./locales/he-IL.json"),
    rtl: true,
  },
];

let currentLanguage = languages[0];
const fallbackLanguage = languages[0];

export function setLanguage(newLng: string | undefined) {
  currentLanguage =
    languages.find((language) => language.lng === newLng) || fallbackLanguage;

  document.documentElement.dir = currentLanguage.rtl ? "rtl" : "ltr";

  languageDetector.cacheUserLanguage(currentLanguage.lng);
}

export function getLanguage() {
  return currentLanguage;
}

function findPartsForData(data: any, parts: string[]) {
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
}

export function t(path: string, replacement?: { [key: string]: string }) {
  const parts = path.split(".");
  let translation =
    findPartsForData(currentLanguage.data, parts) ||
    findPartsForData(fallbackLanguage.data, parts);
  if (translation === undefined) {
    throw new Error(`Can't find translation for ${path}`);
  }

  if (replacement) {
    for (var key in replacement) {
      translation = translation.replace(`{{${key}}}`, replacement[key]);
    }
  }
  return translation;
}

const languageDetector = new LanguageDetector();
languageDetector.init({
  languageUtils: {
    formatLanguageCode: function (lng: string) {
      return lng;
    },
    isWhitelisted: () => true,
  },
  checkWhitelist: false,
});

setLanguage(languageDetector.detect());
