import clsx from "clsx";

// TODO: It might be "clever" to add option.icon to the existing component <ButtonSelect />
export const ButtonIconSelect = <T extends Object>(
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
  <div className="buttonList buttonListIcon">
    {props.options.map((option) =>
      props.type === "button" ? (
        <button
          type="button"
          key={option.text}
          onClick={(event) => props.onClick(option.value, event)}
          className={clsx({
            active: option.active ?? props.value === option.value,
          })}
          data-testid={option.testId}
          title={option.text}
        >
          {option.icon}
        </button>
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
  </div>
);
