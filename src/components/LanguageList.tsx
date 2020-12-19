import React from "react";
import clsx from "clsx";
import * as i18n from "../i18n";

export const LanguageList = ({
  onChange,
  languages = i18n.languages,
  currentLanguage = i18n.getLanguage(),
  floating,
}: {
  languages?: i18n.Language[];
  onChange: (value: string) => void;
  currentLanguage?: i18n.Language;
  floating?: boolean;
}) => (
  <React.Fragment>
    <select
      className={clsx("dropdown-select dropdown-select__language", {
        "dropdown-select--floating": floating,
      })}
      onChange={({ target }) => onChange(target.value)}
      value={currentLanguage.lng}
      aria-label={i18n.t("buttons.selectLanguage")}
    >
      {languages.map((language) => (
        <option key={language.lng} value={language.lng}>
          {currentLanguage.rtl && !language.rtl
            ? `${language.label} ${language.emoji}`
            : `${language.emoji} ${language.label}`}
        </option>
      ))}
    </select>
  </React.Fragment>
);
