import clsx from "clsx";

export const ButtonSelect = <T extends Object>({
  options,
  value,
  onChange,
  group,
}: {
  options: { value: T; text: string }[];
  value: T | null;
  onChange: (value: T) => void;
  group: string;
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
        {option.text}
      </label>
    ))}
  </div>
);
