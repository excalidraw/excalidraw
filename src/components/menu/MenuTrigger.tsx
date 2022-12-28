import clsx from "clsx";
import { useAtom } from "jotai";
import { isMenuOpenAtom, useDevice, useExcalidrawAppState } from "../App";
import { HamburgerMenuIcon } from "../icons";

const MenuTrigger = () => {
  const appState = useExcalidrawAppState();
  const [isMenuOpen, setIsMenuOpen] = useAtom(isMenuOpenAtom);
  const device = useDevice();
  return (
    <button
      data-prevent-outside-click
      className={clsx("menu-button", "zen-mode-transition", {
        "transition-left": appState.zenModeEnabled,
        "menu-button--mobile": device.isMobile,
      })}
      onClick={() => setIsMenuOpen(!isMenuOpen)}
      type="button"
      data-testid="menu-button"
    >
      {HamburgerMenuIcon}
    </button>
  );
};

export default MenuTrigger;
