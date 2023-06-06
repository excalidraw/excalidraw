import clsx from "clsx";

import "./Switch.scss";

export type SwitchProps = {
  name: string;
  checked: boolean;
  title?: string;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

export const Switch = ({
  title,
  name,
  checked,
  onChange,
  disabled = false,
}: SwitchProps) => {
  return (
    <div className={clsx("Switch", { toggled: checked, disabled })}>
      <input
        name={name}
        id={name}
        title={title}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(!checked)}
        onKeyDown={(event) => {
          if (event.key === " ") {
            onChange(!checked);
          }
        }}
      />
    </div>
  );
};
