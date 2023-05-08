import clsx from "clsx";
import { useUIAppState } from "../../context/ui-appState";
import { useDevice } from "../App";

const MenuTrigger = ({
  className = "",
  children,
  onToggle,
}: {
  className?: string;
  children: React.ReactNode;
  onToggle: () => void;
}) => {
  const appState = useUIAppState();
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
    <button
      data-prevent-outside-click
      className={classNames}
      onClick={onToggle}
      type="button"
      data-testid="dropdown-menu-button"
    >
      {children}
    </button>
  );
};

export default MenuTrigger;
MenuTrigger.displayName = "DropdownMenuTrigger";
