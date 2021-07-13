import React from "react";
import * as i18n from "../../i18n";

export const LanguageList = ({
  onChange,
  languages = i18n.languages,
  currentLangCode = i18n.getLanguage().code,
}: {
  languages?: { code: string; label: string }[];
  onChange: (langCode: i18n.Language["code"]) => void;
  currentLangCode?: i18n.Language["code"];
}) => (
  <React.Fragment>
    <select
      className="dropdown-select dropdown-select__language"
      onChange={({ target }) => onChange(target.value)}
      value={currentLangCode}
      aria-label={i18n.t("buttons.selectLanguage")}
    >
      <option key={i18n.defaultLang.code} value={i18n.defaultLang.code}>
        {i18n.defaultLang.label}
      </option>
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.label}
        </option>
      ))}
    </select>
  </React.Fragment>
);
