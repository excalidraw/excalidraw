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
        <span
          style={{
            color: "var(--icon-fill-color)",
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
