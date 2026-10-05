import clsx from "clsx";
import { forwardRef } from "react";

import type { JSX } from "react";

interface RadioButtonProps {
  icon: JSX.Element;
  title: string;
  className?: string;
  testId?: string;
  /** if not supplied, defaults to value identity check */
  active?: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  style?: React.CSSProperties;
}

export const RadioButton = forwardRef<HTMLButtonElement, RadioButtonProps>(
  (props, ref) => {
    const { title, className, testId, active, icon, onClick } = props;
    return (
      <button
        type="button"
        ref={ref}
        key={title}
        title={title}
        data-testid={testId}
        className={clsx(className, { active })}
        onClick={onClick}
        style={props.style}
      >
        {icon}
      </button>
    );
  },
);
