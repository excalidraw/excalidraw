import React, { useState, useEffect } from "react";
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

  // delay display of `languages`  to the screen by 10 ms
  // only on first mount in order to
  // avoid google translate offering translations
  const [delayedLanguages, setDelayedLanguages] = useState(
    languages.filter(l => currentLanguage === l.lng),
  );

  useEffect(() => {
    setTimeout(() => {
      setDelayedLanguages(languages);
    }, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <React.Fragment>
      <select
        className="language-select"
        onChange={({ target }) => onClick(target.value)}
        value={currentLanguage}
        aria-label={t("buttons.selectLanguage")}
      >
        {delayedLanguages.map(language => (
          <option key={language.lng} value={language.lng}>
            {language.label}
          </option>
        ))}
      </select>
    </React.Fragment>
  );
}
