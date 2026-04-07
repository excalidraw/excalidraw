import { useEffect } from "react";

import { atom, useAtom } from "../app-jotai";

import { getPreferredLanguage, languageDetector } from "./language-detector";

export const appLangCodeAtom = atom(getPreferredLanguage());

export const useAppLangCode = () => {
  const [langCode, setLangCode] = useAtom(appLangCodeAtom);

  useEffect(() => {
    languageDetector.cacheUserLanguage(langCode);
  }, [langCode]);

  return [langCode, setLangCode] as const;
};
