import React, { useMemo } from "react";
import DropdownMenu from "./dropdownMenu/DropdownMenu";
import "./Select.scss";

export type SelectProps<T> = {
  onSelect: (value: T) => void;
  options: { value: T; label: string }[];
  value: T;
};

export const Select = <T,>({ onSelect, options, value }: SelectProps<T>) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const currentLabel = useMemo(() => {
    return options.find((option) => option.value === value)?.label;
  }, [value, options]);

  return (
    <div className="Select">
      <DropdownMenu open={isOpen}>
        <DropdownMenu.Trigger onToggle={() => setIsOpen(!isOpen)}>
          {currentLabel}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          onClickOutside={() => {
            setIsOpen(false);
          }}
          onSelect={() => setIsOpen(false)}
          className="Select__content"
        >
          {options.map(({ value, label }) => {
            return (
              <DropdownMenu.Item
                key={label}
                onSelect={() => {
                  onSelect(value);
                  setIsOpen(false);
                }}
              >
                {label}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
};
