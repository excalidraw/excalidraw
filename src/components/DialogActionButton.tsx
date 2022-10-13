import clsx from "clsx";
import { ReactNode } from "react";
import "./DialogActionButton.scss";

interface DialogActionButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
  children?: ReactNode;
  isDangerous?: boolean;
}

const DialogActionButton = ({
  label,
  onClick,
  className,
  children,
  isDangerous,
}: DialogActionButtonProps) => {
  return (
    <button
      className={clsx(
        "Dialog__action-button",
        { "Dialog__action-button--danger": isDangerous },
        className,
      )}
      type="button"
      aria-label={label}
      onClick={onClick}
    >
      {children && <div>{children}</div>}
      <div>{label}</div>
    </button>
  );
};

export default DialogActionButton;
