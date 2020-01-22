import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import Backend from "i18next-xhr-backend";
import LanguageDetector from "i18next-browser-languagedetector";

export const fallbackLng = "en";

export function parseDetectedLang(lng: string | undefined): string {
  if (lng) {
    const [lang] = i18n.language.split("-");
    return lang;
  }
  return fallbackLng;
}

export const languages = [
  { lng: "en", label: "English" },
  { lng: "es", label: "Español" }
];

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng,
    react: { useSuspense: false },
    load: "languageOnly"
  });

export default i18n;
