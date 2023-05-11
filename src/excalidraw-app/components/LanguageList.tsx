import { useSetAtom } from "jotai";
import React from "react";
import { appLangCodeAtom } from "..";
import { defaultLang, useI18n } from "../../i18n";
import { languages } from "../../i18n";

export const LanguageList = ({ style }: { style?: React.CSSProperties }) => {
  const { t, langCode } = useI18n();
  const setLangCode = useSetAtom(appLangCodeAtom);

  return (
    <select
      className="dropdown-select dropdown-select__language"
      onChange={({ target }) => setLangCode(target.value)}
      value={langCode}
      aria-label={t("buttons.selectLanguage")}
      style={style}
    >
      <option key={defaultLang.code} value={defaultLang.code}>
        {defaultLang.label}
      </option>
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.label}
        </option>
      ))}
    </select>
  );
};
