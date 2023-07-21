import clsx from "clsx";
import { useDevice } from "../App";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

const MenuTrigger = ({
  className = "",
  children,
  onToggle,
  title,
  ...rest
}: {
  className?: string;
  children: React.ReactNode;
  onToggle: () => void;
  title?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onSelect">) => {
  const device = useDevice();
  const classNames = clsx(
    `dropdown-menu-button ${className}`,
    "zen-mode-transition",
    {
      "dropdown-menu-button--mobile": device.isMobile,
    },
  ).trim();
  return (
    <DropdownMenuPrimitive.Trigger
      data-dropdown-menu-trigger
      data-prevent-outside-click
      className={classNames}
      onClick={onToggle}
      type="button"
      data-testid="dropdown-menu-button"
      title={title}
      {...rest}
    >
      {children}
    </DropdownMenuPrimitive.Trigger>
  );
};

export default MenuTrigger;
MenuTrigger.displayName = "DropdownMenuTrigger";
