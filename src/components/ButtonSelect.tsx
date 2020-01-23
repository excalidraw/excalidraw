import React from "react";

export function ButtonSelect<T>({
  options,
  value,
  onChange,
  group
}: {
  options: { value: T; text: string }[];
  value: T | null;
  onChange: (value: T) => void;
  group: string;
}) {
  return (
    <div className="buttonList">
      {options.map(option => (
        <label key={option.text}>
          <input
            type="radio"
            name={group}
            onChange={() => onChange(option.value)}
            className={value === option.value ? "active" : ""}
            checked={value === option.value ? true : false}
          />
          {option.text}
        </label>
      ))}
    </div>
  );
}
