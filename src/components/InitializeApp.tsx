import React, { useEffect, useState } from "react";

import { LoadingMessage } from "./LoadingMessage";
import { defaultLang, Language, languages, setLanguage } from "../i18n";

interface Props {
  langCode: Language["code"];
  children: React.ReactElement;
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

  return loading ? <LoadingMessage /> : props.children;
};
