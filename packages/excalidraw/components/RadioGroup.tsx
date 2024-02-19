import clsx from "clsx";
import "./RadioGroup.scss";

export type RadioGroupChoice<T> = {
  value: T;
  label: string;
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
          key={choice.label}
        >
          <input
            name={name}
            type="radio"
            checked={choice.value === value}
            onChange={() => onChange(choice.value)}
          />
          {choice.label}
        </div>
      ))}
    </div>
  );
};
