import clsx from "clsx";
import { useDevice, useExcalidrawAppState } from "../App";
import { Button } from "../Button";

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
    <Button
      onSelect={onToggle}
      className={classNames}
      data-prevent-outside-click
      data-testid="dropdown-menu-button"
    >
      {children}
    </Button>
  );
};

export default MenuTrigger;
MenuTrigger.displayName = "DropdownMenuTrigger";
