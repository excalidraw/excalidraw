import React from "react";
import * as i18n from "../i18n";

export function LanguageList({
  onChange,
  languages = i18n.languages,
  currentLanguage = i18n.getLanguage().lng,
  floating,
}: {
  languages?: { lng: string; label: string }[];
  onChange: (value: string) => void;
  currentLanguage?: string;
  floating?: boolean;
}) {
  return (
    <React.Fragment>
      <select
        className={`dropdown-select dropdown-select__language${
          floating ? " dropdown-select--floating" : ""
        }`}
        onChange={({ target }) => onChange(target.value)}
        value={currentLanguage}
        aria-label={i18n.t("buttons.selectLanguage")}
      >
        {languages.map((language) => (
          <option key={language.lng} value={language.lng}>
            {language.label}
          </option>
        ))}
      </select>
    </React.Fragment>
  );
}
