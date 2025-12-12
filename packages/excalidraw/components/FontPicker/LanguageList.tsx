import React from "react";

export const LanguageList = ({ currentLanguage, onLanguageChange }: { currentLanguage: string, onLanguageChange: (language: string) => void }) => {
  const languages = ["en", "kannada", "hindi"]; // Add more languages as needed

  return (
    <div className="language-list">
      <select value={currentLanguage} onChange={(e) => onLanguageChange(e.target.value)}>
        {languages.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </select>
    </div>
  );
};