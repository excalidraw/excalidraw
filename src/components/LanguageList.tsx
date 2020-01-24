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
    <ul>
      {languages.map((language, idx) => (
        <li
          key={idx}
          className={currentLanguage === language.lng ? "current" : ""}
        >
          <a
            href="/"
            onClick={e => {
              onClick(language.lng);
              e.preventDefault();
            }}
          >
            {language.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
