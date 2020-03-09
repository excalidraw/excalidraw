import LanguageDetector from "i18next-browser-languagedetector";

export const languages = [
  { lng: "en", label: "English", data: require("./locales/en.json") },
  { lng: "de", label: "Deutsch", data: require("./locales/de.json") },
  { lng: "es", label: "Español", data: require("./locales/es.json") },
  { lng: "fr", label: "Français", data: require("./locales/fr.json") },
  { lng: "id", label: "Bahasa Indonesia", data: require("./locales/id.json") },
  { lng: "no", label: "Norsk", data: require("./locales/no.json") },
  { lng: "pl", label: "Polski", data: require("./locales/pl.json") },
  { lng: "pt", label: "Português", data: require("./locales/pt.json") },
  { lng: "ru", label: "Русский", data: require("./locales/ru.json") },
  { lng: "tr", label: "Türkçe", data: require("./locales/tr.json") },
];

let currentLanguage = languages[0];
const fallbackLanguage = languages[0];

export function setLanguage(newLng: string | undefined) {
  currentLanguage =
    languages.find(language => language.lng === newLng) || fallbackLanguage;

  languageDetector.cacheUserLanguage(currentLanguage.lng);
}

export function getLanguage() {
  return currentLanguage.lng;
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
    formatLanguageCode: function(lng: string) {
      return lng;
    },
    isWhitelisted: () => true,
  },
  checkWhitelist: false,
});

setLanguage(languageDetector.detect());
