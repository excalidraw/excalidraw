import React, { useEffect, useState } from "react";

import { LoadingMessage } from "./LoadingMessage";
import { defaultLang, Language, languages, setLanguage } from "../i18n";
import { Theme } from "../element/types";
import { preloadCustomFonts, getCustomFonts } from "../font";

interface Props {
  langCode: Language["code"];
  children: React.ReactElement;
  theme?: Theme;
}

const loadCustomFonts = async () => {
  const customFonts = getCustomFonts();
  if (!customFonts) {
    return;
  }
  await preloadCustomFonts(customFonts);
  if (customFonts.handwriting) {
    const fontFaceRule = `
      @font-face {
        font-family: 'Virgil';
        src: url('${customFonts.handwriting}') format('woff2');
      }
    `;
    const styleElement = document.createElement('style');
    styleElement.textContent = fontFaceRule;
    document.head.appendChild(styleElement);
  }
  if (customFonts.normal) {
    const fontFaceRule = `
      @font-face {
        font-family: 'Helvetica';
        src: url('${customFonts.normal}') format('woff2');
      }
    `;
    const styleElement = document.createElement('style');
    styleElement.textContent = fontFaceRule;
    document.head.appendChild(styleElement);
  }
  if (customFonts.code) {
    const fontFaceRule = `
      @font-face {
        font-family: 'Cascadia';
        src: url('${customFonts.code}') format('woff2');
      }
    `;
    const styleElement = document.createElement('style');
    styleElement.textContent = fontFaceRule;
    document.head.appendChild(styleElement);
  }
}

export const InitializeApp = (props: Props) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const updateFonts = async () => {
      await loadCustomFonts();  
    }; 
    const updateLang = async () => {
      await setLanguage(currentLang);
    };
    const initialize = async () => {
      await updateFonts();
      await updateLang();
      setLoading(false);
    };
    const currentLang =
      languages.find((lang) => lang.code === props.langCode) || defaultLang;
    initialize();
  }, [props.langCode]);

  return loading ? <LoadingMessage theme={props.theme} /> : props.children;
};
