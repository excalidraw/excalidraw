import clsx from "clsx";
import { useDevice, useExcalidrawAppState } from "../App";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

const MenuTrigger = ({
  className = "",
  children,
  onToggle,
}: {
  className?: string;
  children: React.ReactNode;
  onToggle: () => void;
}) => {
  const appState = useExcalidrawAppState();
  const device = useDevice();
  const classNames = clsx(
    `dropdown-menu-button ${className}`,
    "zen-mode-transition",
    {
      "transition-left": appState.zenModeEnabled,
      "dropdown-menu-button--mobile": device.isMobile,
    },
  ).trim();
  return (
    <DropdownMenuPrimitive.Trigger
      data-prevent-outside-click
      className={classNames}
      onClick={onToggle}
      type="button"
      data-testid="dropdown-menu-button"
    >
      {children}
    </DropdownMenuPrimitive.Trigger>
  );
};

export default MenuTrigger;
MenuTrigger.displayName = "DropdownMenuTrigger";
