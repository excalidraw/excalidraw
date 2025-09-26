import React, { useEffect, useState } from "react";

import type { Theme } from "@excalidraw/element/types";

import { defaultLang, languages, setLanguage } from "../i18n";

import { LoadingMessage } from "./LoadingMessage";

import type { Language } from "../i18n";

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
