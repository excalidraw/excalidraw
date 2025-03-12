import clsx from "clsx";
import React from "react";

import { composeEventHandlers } from "../utils";

import "./Button.scss";

interface ButtonProps
  extends React.DetailedHTMLProps<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > {
  type?: "button" | "submit" | "reset";
  onSelect: () => any;
  /** whether button is in active state */
  selected?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * A generic button component that follows Excalidraw's design system.
 * Style can be customised using `className` or `style` prop.
 * Accepts all props that a regular `button` element accepts.
 */
export const Button = ({
  type = "button",
  onSelect,
  selected,
  children,
  className = "",
  ...rest
}: ButtonProps) => {
  return (
    <button
      onClick={composeEventHandlers(rest.onClick, (event) => {
        onSelect();
      })}
      type={type}
      className={clsx("excalidraw-button", className, { selected })}
      {...rest}
    >
      {children}
    </button>
  );
};
