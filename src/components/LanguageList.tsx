import React from "react";
import { t } from "../i18n";

export function LanguageList<T>({
  onChange,
  languages,
  currentLanguage,
  floating,
}: {
  languages: { lng: string; label: string }[];
  onChange: (value: string) => void;
  currentLanguage: string;
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
        aria-label={t("buttons.selectLanguage")}
      >
        {languages.map(language => (
          <option key={language.lng} value={language.lng}>
            {language.label}
          </option>
        ))}
      </select>
    </React.Fragment>
  );
}
