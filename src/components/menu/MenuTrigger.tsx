import clsx from "clsx";
import { useAtom } from "jotai";
import { isMenuOpenAtom, useExcalidrawAppState } from "../App";
import { HamburgerMenuIcon } from "../icons";

const MenuTrigger = () => {
  const appState = useExcalidrawAppState();
  const [isMenuOpen, setIsMenuOpen] = useAtom(isMenuOpenAtom);

  return (
    <button
      data-prevent-outside-click
      className={clsx("menu-button", "zen-mode-transition", {
        "transition-left": appState.zenModeEnabled,
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
