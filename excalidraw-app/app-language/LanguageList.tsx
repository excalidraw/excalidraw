import { useI18n, languages } from "@excalidraw/excalidraw/i18n";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React from "react";

import { useSetAtom } from "../app-jotai";

import { appLangCodeAtom } from "./language-state";

export const LanguageList = () => {
  const { t, langCode } = useI18n();
  const setLangCode = useSetAtom(appLangCodeAtom);

  return (
    <MainMenu.Sub>
      <MainMenu.Sub.Trigger>{t("buttons.selectLanguage")}</MainMenu.Sub.Trigger>
      <MainMenu.Sub.Content>
        {languages.map((lang) => (
          <MainMenu.Item
            key={lang.code}
            selected={lang.code === langCode}
            onSelect={(event) => {
              setLangCode(lang.code);
              event.preventDefault();
            }}
          >
            {lang.label}
          </MainMenu.Item>
        ))}
      </MainMenu.Sub.Content>
    </MainMenu.Sub>
  );
};
