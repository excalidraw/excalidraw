import clsx from "clsx";
import { useDevice } from "../App";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";

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
  const appState = useUIAppState();
  const device = useDevice();
  const classNames = clsx(
    `dropdown-menu-button ${className}`,
    "zen-mode-transition",
    {
      "dropdown-menu-button--mobile": device.editor.isMobile,
    },
    {
      "dropdown-menu-button--tray":
        !device.editor.isMobile && appState.stylesPanelMode === "tray", //zsviczian
    },
  ).trim();
  return (
    <button
      data-prevent-outside-click
      className={classNames}
      onClick={onToggle}
      type="button"
      data-testid="dropdown-menu-button"
      title={title}
      {...rest}
    >
      {children}
    </button>
  );
};

export default MenuTrigger;
MenuTrigger.displayName = "DropdownMenuTrigger";
