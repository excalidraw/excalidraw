import clsx from "clsx";
import { iconFillColor } from "../components/icons";
import { Theme } from "../element/types";

export const ButtonSelect = <T extends Object>({
  options,
  value,
  onChange,
  group,
  theme,
}: {
  options: { value: T; text: string }[];
  value: T | null;
  onChange: (value: T) => void;
  group: string;
  theme: Theme;
}) => (
  <div className="buttonList">
    {options.map((option) => (
      <label
        key={option.text}
        className={clsx({ active: value === option.value })}
        style={{ color: iconFillColor(theme), fontWeight: "bold" }}
      >
        <input
          type="radio"
          name={group}
          onChange={() => onChange(option.value)}
          checked={value === option.value}
        />
        {option.text}
      </label>
    ))}
  </div>
);
