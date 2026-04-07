import { defaultLang, languages } from "@excalidraw/excalidraw";
import LanguageDetector from "i18next-browser-languagedetector";

export const languageDetector = new LanguageDetector();

languageDetector.init({
  languageUtils: {},
});

export const getPreferredLanguage = () => {
  const detectedLanguages = languageDetector.detect();

  const detectedLanguage = Array.isArray(detectedLanguages)
    ? detectedLanguages[0]
    : detectedLanguages;

  const initialLanguage =
    (detectedLanguage
      ? // region code may not be defined if user uses generic preferred language
        // (e.g. chinese vs instead of chinese-simplified)
        languages.find((lang) => lang.code.startsWith(detectedLanguage))?.code
      : null) || defaultLang.code;

  return initialLanguage;
};
