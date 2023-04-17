import clsx from "clsx";
import { useDevice, useExcalidrawAppState } from "../App";
import * as DropdownMenuRadix from "@radix-ui/react-dropdown-menu";

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
    <DropdownMenuRadix.Trigger
      data-prevent-outside-click
      className={classNames}
      onClick={onToggle}
      type="button"
      data-testid="dropdown-menu-button"
    >
      {children}
    </DropdownMenuRadix.Trigger>
  );
};

export default MenuTrigger;
MenuTrigger.displayName = "DropdownMenuTrigger";
