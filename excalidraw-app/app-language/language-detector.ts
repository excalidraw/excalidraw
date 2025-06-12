import { defaultLang } from "@excalidraw/excalidraw";

export const getPreferredLanguage = () => {
  const initialLanguage = defaultLang.code;
  return initialLanguage;
};
