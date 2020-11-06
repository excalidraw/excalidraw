import React from "react";
import clsx from "clsx";

// TODO: It might be "clever" to add option.icon to the existing component <ButtonSelect />
export const ButtonIconSelect = <T extends Object>({
  options,
  value,
  onChange,
  group,
}: {
  options: { value: T; text: string; icon: JSX.Element }[];
  value: T | null;
  onChange: (value: T) => void;
  group: string;
}) => (
  <div className="buttonList buttonListIcon">
    {options.map((option) => (
      <label
        key={option.text}
        className={clsx({ active: value === option.value })}
        title={option.text}
      >
        <input
          type="radio"
          name={group}
          onChange={() => onChange(option.value)}
          checked={value === option.value}
        />
        {option.icon}
      </label>
    ))}
  </div>
);
