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
      >
        <input
          type="radio"
          name={group}
          onChange={() => onChange(option.value)}
          checked={value === option.value}
        />
        <span
          style={{
            color: iconFillColor(theme),
            fontWeight: "bold",
            opacity: value === option.value ? 1.0 : 0.6,
          }}
        >
          {option.text}
        </span>
      </label>
    ))}
  </div>
);
