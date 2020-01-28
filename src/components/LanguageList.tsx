import React from "react";
import { useTranslation } from "react-i18next";

export function LanguageList<T>({
  onClick,
  languages,
  currentLanguage,
}: {
  languages: { lng: string; label: string }[];
  onClick: (value: string) => void;
  currentLanguage: string;
}) {
  const { t } = useTranslation();

  return (
    <React.Fragment>
      <select
        className="language-select"
        onChange={({ target }) => onClick(target.value)}
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
