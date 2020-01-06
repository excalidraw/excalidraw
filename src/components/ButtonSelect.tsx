import React from "react";

export function ButtonSelect<T>({
  options,
  value,
  onChange
}: {
  options: { value: T; text: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div className="buttonList">
      {options.map(option => (
        <button
          key={option.text}
          onClick={() => onChange(option.value)}
          className={value === option.value ? "active" : ""}
        >
          {option.text}
        </button>
      ))}
    </div>
  );
}
