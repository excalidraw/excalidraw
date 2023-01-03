import clsx from "clsx";
import { useDevice, useExcalidrawAppState } from "../App";

const MenuTrigger = ({
  className = "",
  children,
  onClick,
}: {
  className?: string;
  children: React.ReactNode;
  onClick: () => void;
}) => {
  const appState = useExcalidrawAppState();
  const device = useDevice();
  const classNames = clsx(`menu-button ${className}`, "zen-mode-transition", {
    "transition-left": appState.zenModeEnabled,
    "menu-button--mobile": device.isMobile,
  }).trim();
  return (
    <button
      data-prevent-outside-click
      className={classNames}
      onClick={onClick}
      type="button"
      data-testid="menu-button"
    >
      {children}
    </button>
  );
};

export default MenuTrigger;
MenuTrigger.displayName = "MenuTrigger";
