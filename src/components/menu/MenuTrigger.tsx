import clsx from "clsx";
import { useAtom } from "jotai";
import { useDevice, useExcalidrawAppState } from "../App";
import { HamburgerMenuIcon } from "../icons";
import { isMenuOpenAtom } from "./Menu";

const MenuTrigger = ({
  className = "",
  children = HamburgerMenuIcon,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  const appState = useExcalidrawAppState();
  const [isMenuOpen, setIsMenuOpen] = useAtom(isMenuOpenAtom);
  const device = useDevice();
  const classNames = clsx(`menu-button ${className}`, "zen-mode-transition", {
    "transition-left": appState.zenModeEnabled,
    "menu-button--mobile": device.isMobile,
  }).trim();
  return (
    <button
      data-prevent-outside-click
      className={classNames}
      onClick={() => setIsMenuOpen(!isMenuOpen)}
      type="button"
      data-testid="menu-button"
    >
      {children}
    </button>
  );
};

export default MenuTrigger;
MenuTrigger.displayName = "MenuTrigger";
