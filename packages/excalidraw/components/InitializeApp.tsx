import React, { useEffect, useState } from "react";

import type { Language } from "../i18n";
import { defaultLang, languages, setLanguage } from "../i18n";
import type { Theme } from "../element/types";
import { LoadingMessage } from "./LoadingMessage";

interface Props {
  langCode: Language["code"];
  children: React.ReactElement;
  theme?: Theme;
}

export const InitializeApp = (props: Props) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const updateLang = async () => {
      await setLanguage(currentLang);
      setLoading(false);
    };
    const currentLang =
      languages.find((lang) => lang.code === props.langCode) || defaultLang;
    updateLang();
  }, [props.langCode]);

  return loading ? <LoadingMessage theme={props.theme} /> : props.children;
};
