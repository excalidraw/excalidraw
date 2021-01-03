import React from "react";
import clsx from "clsx";
import * as i18n from "../../i18n";

export const LanguageList = ({
  onChange,
  languages = i18n.languages,
  currentLanguage = i18n.getLanguage().code,
  floating,
}: {
  languages?: { code: string; label: string }[];
  onChange: (value: string) => void;
  currentLanguage?: string;
  floating?: boolean;
}) => (
  <React.Fragment>
    <select
      className={clsx("dropdown-select dropdown-select__language", {
        "dropdown-select--floating": floating,
      })}
      onChange={({ target }) => onChange(target.value)}
      value={currentLanguage}
      aria-label={i18n.t("buttons.selectLanguage")}
    >
      {languages.map((language) => (
        <option key={language.code} value={language.code}>
          {language.label}
        </option>
      ))}
    </select>
  </React.Fragment>
);
