import clsx from "clsx";

import type { JSX } from "react";

export const ButtonIconCycle = <T extends any>({
  options,
  value,
  onChange,
  group,
}: {
  options: { value: T; text: string; icon: JSX.Element }[];
  value: T | null;
  onChange: (value: T) => void;
  group: string;
}) => {
  const current = options.find((op) => op.value === value);

  const cycle = () => {
    const index = options.indexOf(current!);
    const next = (index + 1) % options.length;
    onChange(options[next].value);
  };

  return (
    <label key={group} className={clsx({ active: current!.value !== null })}>
      <input type="button" name={group} onClick={cycle} />
      {current!.icon}
    </label>
  );
};
