import clsx from "clsx";

import "./RadioGroup.scss";

export type RadioGroupChoice<T> = {
  value: T;
  label: React.ReactNode;
  ariaLabel?: string;
};

export type RadioGroupProps<T> = {
  choices: RadioGroupChoice<T>[];
  value: T;
  onChange: (value: T) => void;
  name: string;
};

export const RadioGroup = function <T>({
  onChange,
  value,
  choices,
  name,
}: RadioGroupProps<T>) {
  return (
    <div className="RadioGroup">
      {choices.map((choice) => (
        <div
          className={clsx("RadioGroup__choice", {
            active: choice.value === value,
          })}
          key={String(choice.value)}
          title={choice.ariaLabel}
        >
          <input
            name={name}
            type="radio"
            checked={choice.value === value}
            onChange={() => onChange(choice.value)}
            aria-label={choice.ariaLabel}
          />
          {choice.label}
        </div>
      ))}
    </div>
  );
};
