import React, { useEffect, useState } from "react";

import type { Theme } from "@excalidraw/element/types";

import { defaultLang, setLanguage } from "../i18n";

import { LoadingMessage } from "./LoadingMessage";

interface Props {
  children: React.ReactElement;
  theme?: Theme;
}

export const InitializeApp = (props: Props) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const updateLang = async () => {
      await setLanguage(defaultLang);
      setLoading(false);
    };
    updateLang();
  }, []);

  return loading ? <LoadingMessage theme={props.theme} /> : props.children;
};
