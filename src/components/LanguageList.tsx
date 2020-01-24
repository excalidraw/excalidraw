import React from "react";

export function LanguageList<T>({
  onClick,
  languages,
  currentLanguage,
}: {
  languages: { lng: string; label: string }[];
  onClick: (value: string) => void;
  currentLanguage: string;
}) {
  return (
    <React.Fragment>
      <select
        className="language-select"
        onChange={({ target }) => onClick(target.value)}
        value={currentLanguage}
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
