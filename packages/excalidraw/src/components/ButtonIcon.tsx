import clsx from "clsx";
import { forwardRef } from "react";

import "./ButtonIcon.scss";

import type { JSX } from "react";

interface ButtonIconProps {
  icon: JSX.Element;
  title: string;
  className?: string;
  testId?: string;
  /** if not supplied, defaults to value identity check */
  active?: boolean;
  /** include standalone style (could interfere with parent styles) */
  standalone?: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}

export const ButtonIcon = forwardRef<HTMLButtonElement, ButtonIconProps>(
  (props, ref) => {
    const { title, className, testId, active, standalone, icon, onClick } =
      props;
    return (
      <button
        type="button"
        ref={ref}
        key={title}
        title={title}
        data-testid={testId}
        className={clsx(className, { standalone, active })}
        onClick={onClick}
      >
        {icon}
      </button>
    );
  },
);
