import clsx from "clsx";
import { Tooltip } from "./Tooltip";

// TODO: It might be "clever" to add option.icon to the existing component <ButtonSelect />
export const ButtonIconSelect = <T extends Object>({
  options,
  value,
  onChange,
  group,
}: {
  options: { value: T; text: string; icon: JSX.Element; testId?: string }[];
  value: T | null;
  onChange: (value: T) => void;
  group: string;
}) => (
  <div className="buttonList buttonListIcon">
    {options.map((option) => (
      <Tooltip label={option.text} key={option.text}>
        <label className={clsx({ active: value === option.value })}>
          <input
            type="radio"
            name={group}
            onChange={() => onChange(option.value)}
            checked={value === option.value}
            data-testid={option.testId}
          />
          {option.icon}
        </label>
      </Tooltip>
    ))}
  </div>
);
