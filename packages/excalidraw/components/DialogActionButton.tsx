import clsx from "clsx";
import type { ReactNode } from "react";
import "./DialogActionButton.scss";
import Spinner from "./Spinner";

interface DialogActionButtonProps {
  label: string;
  children?: ReactNode;
  actionType?: "primary" | "danger";
  isLoading?: boolean;
}

const DialogActionButton = ({
  label,
  onClick,
  className,
  children,
  actionType,
  type = "button",
  isLoading,
  ...rest
}: DialogActionButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const cs = actionType ? `Dialog__action-button--${actionType}` : "";

  return (
    <button
      className={clsx("Dialog__action-button", cs, className)}
      type={type}
      aria-label={label}
      onClick={onClick}
      {...rest}
    >
      {children && (
        <div style={isLoading ? { visibility: "hidden" } : {}}>{children}</div>
      )}
      <div style={isLoading ? { visibility: "hidden" } : {}}>{label}</div>
      {isLoading && (
        <div style={{ position: "absolute", inset: 0 }}>
          <Spinner />
        </div>
      )}
    </button>
  );
};

export default DialogActionButton;
