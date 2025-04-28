import clsx from "clsx";

import { useContext, type JSX } from "react";

import { ExcalidrawPropsCustomOptionsContext } from "../types";

import { ButtonIcon } from "./ButtonIcon";

export type ButtonIconSelectProps<T> = {
  options: {
    value: T;
    text: string;
    icon: JSX.Element;
    testId?: string;
    /** if not supplied, defaults to value identity check */
    active?: boolean;
  }[];
  value: T | null;
  type?: "radio" | "button";
} & (
  | { type?: "radio"; group: string; onChange: (value: T) => void }
  | {
      type: "button";
      onClick: (
        value: T,
        event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
      ) => void;
    }
);

// TODO: It might be "clever" to add option.icon to the existing component <ButtonSelect />
export const ButtonIconSelect = <T extends Object>(
  props: ButtonIconSelectProps<T>,
) => {
  const customOptions = useContext(ExcalidrawPropsCustomOptionsContext);

  if (customOptions?.pickerRenders?.buttonIconSelectRender) {
    return customOptions.pickerRenders.buttonIconSelectRender(props);
  }

  const renderButtonIcon = (
    option: ButtonIconSelectProps<T>["options"][number],
  ) => {
    if (props.type !== "button") {
      return null;
    }

    if (customOptions?.pickerRenders?.CustomButtonIcon) {
      return (
        <customOptions.pickerRenders.CustomButtonIcon
          key={option.text}
          icon={option.icon}
          title={option.text}
          testId={option.testId}
          active={option.active ?? props.value === option.value}
          onClick={(event) => props.onClick(option.value, event)}
        />
      );
    }
    return (
      <ButtonIcon
        key={option.text}
        icon={option.icon}
        title={option.text}
        testId={option.testId}
        active={option.active ?? props.value === option.value}
        onClick={(event) => props.onClick(option.value, event)}
      />
    );
  };

  const renderRadioButtonIcon = (
    option: ButtonIconSelectProps<T>["options"][number],
  ) => {
    if (props.type === "button") {
      return null;
    }

    if (customOptions?.pickerRenders?.buttonIconSelectRadioRender) {
      return customOptions.pickerRenders.buttonIconSelectRadioRender({
        key: option.text,
        active: props.value === option.value,
        title: option.text,
        name: props.group,
        onChange: () => props.onChange(option.value),
        checked: props.value === option.value,
        dataTestid: option.testId ?? "",
        children: option.icon,
        value: option.value,
      });
    }

    return (
      <label
        key={option.text}
        className={clsx({ active: props.value === option.value })}
        title={option.text}
      >
        <input
          type="radio"
          name={props.group}
          onChange={() => props.onChange(option.value)}
          checked={props.value === option.value}
          data-testid={option.testId}
        />
        {option.icon}
      </label>
    );
  };

  return (
    <div className="buttonList">
      {props.options.map((option) =>
        props.type === "button"
          ? renderButtonIcon(option)
          : renderRadioButtonIcon(option),
      )}
    </div>
  );
};
