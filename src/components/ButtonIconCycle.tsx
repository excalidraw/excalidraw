import React from "react";
import clsx from "clsx";

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
  const [index, setIndex] = React.useState(() =>
    options.findIndex((o) => o.value === value),
  );

  React.useEffect(() => {
    setIndex(options.findIndex((o) => o.value === value));
  }, [value, options]);

  function cycle() {
    const next = (index + 1) % options.length;
    setIndex(next);
    onChange(options[next].value);
  }

  const current = options[index];

  return (
    <label
      key={current.text}
      className={clsx({ active: current.value !== null })}
    >
      <input type="radio" name={group} onClick={cycle} />
      {current.icon}
    </label>
  );
};
