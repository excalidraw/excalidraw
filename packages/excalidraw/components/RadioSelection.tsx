import clsx from "clsx";

import { useContext, type JSX } from "react";

import { ExcalidrawPropsCustomOptionsContext } from "../types";

import { ButtonIcon } from "./ButtonIcon";

export const RadioSelectionCore = <T extends Object>(
  props: {
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
  ),
) => (
  <>
    {props.options.map((option) =>
      props.type === "button" ? (
        <ButtonIcon
          key={option.text}
          icon={option.icon}
          title={option.text}
          testId={option.testId}
          active={option.active ?? props.value === option.value}
          onClick={(event) => props.onClick(option.value, event)}
        />
      ) : (
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
      ),
    )}
  </>
);

export const RadioSelection = ((
  props: Parameters<typeof RadioSelectionCore>[0],
) => {
  const customOptions = useContext(ExcalidrawPropsCustomOptionsContext);

  if (customOptions?.pickerRenders?.RadioSelection) {
    return <customOptions.pickerRenders.RadioSelection {...props} />;
  }

  return <RadioSelectionCore {...props} />;
}) as typeof RadioSelectionCore;
