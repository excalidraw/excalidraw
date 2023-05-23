import clsx from "clsx";

import "./Switch.scss";

export type SwitchProps = {
  name: string;
  checked: boolean;
  title?: string;
  onChange: (value: boolean) => void;
};

export const Switch = ({ title, name, checked, onChange }: SwitchProps) => {
  return (
    <div className={clsx("Switch", { toggled: checked })}>
      <input
        name={name}
        id={name}
        title={title}
        type="checkbox"
        checked={checked}
        onChange={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === " ") {
            onChange(!checked);
          }
        }}
      />
    </div>
  );
};
