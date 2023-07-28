import React, { forwardRef } from "react";
import clxs from "clsx";
import * as RadixSelect from "@radix-ui/react-select";
import "./Select.scss";
import { tablerChevronDownIcon, tablerChevronUpIcon } from "./icons";

type SelectItems = Record<string, string>;

export type SelectProps = {
  items: SelectItems;
  value: keyof SelectItems;
  onChange: (value: keyof SelectItems) => void;
  placeholder?: string;
  ariaLabel?: string;
};

const Select = ({
  items,
  value,
  onChange,
  placeholder,
  ariaLabel,
}: SelectProps) => (
  <RadixSelect.Root value={value} onValueChange={onChange}>
    <RadixSelect.Trigger
      className="Select__trigger"
      aria-label={ariaLabel ?? placeholder}
    >
      {placeholder && <RadixSelect.Value placeholder={placeholder} />}
      <RadixSelect.Icon className="Select__trigger-icon">
        {tablerChevronDownIcon}
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
    <RadixSelect.Content
      className="Select__content"
      position="popper"
      align="center"
    >
      <RadixSelect.ScrollUpButton className="Select__scroll-button">
        {tablerChevronUpIcon}
      </RadixSelect.ScrollUpButton>

      <RadixSelect.Viewport className="Select__viewport">
        {Object.entries(items).map(([itemValue, itemLabel]) => (
          <SelectItem value={itemValue} key={itemValue}>
            {itemLabel}
          </SelectItem>
        ))}
      </RadixSelect.Viewport>

      <RadixSelect.ScrollDownButton className="Select__scroll-button">
        {tablerChevronDownIcon}
      </RadixSelect.ScrollDownButton>
    </RadixSelect.Content>
  </RadixSelect.Root>
);

type SelectItemProps = React.ComponentProps<typeof RadixSelect.Item>;

const SelectItem = forwardRef(
  (
    { children, className, ...props }: SelectItemProps,
    forwardedRef: React.ForwardedRef<HTMLDivElement>,
  ) => {
    return (
      <RadixSelect.Item
        className={clxs("Select__item", className)}
        {...props}
        ref={forwardedRef}
      >
        <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      </RadixSelect.Item>
    );
  },
);

export default Select;
