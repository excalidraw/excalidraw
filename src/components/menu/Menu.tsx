import React from "react";
import { useOutsideClickHook } from "../../hooks/useOutsideClick";
import { useAtom } from "jotai";
import { isMenuOpenAtom } from "../App";
import { Island } from "../Island";
import MenuItem from "./MenuItem";
import MenuButton from "./MenuButton";
import MenuSeparator from "./MenuSeparator";
import * as MenuComponents from "./MenuComponents";
const Menu = ({ children }: { children?: React.ReactNode }) => {
  const [isMenuOpen, setIsMenuOpen] = useAtom(isMenuOpenAtom);
  const menuRef = useOutsideClickHook(() => {
    setIsMenuOpen(false);
  });
  if (!isMenuOpen) {
    return <MenuButton />;
  }
  return (
    <>
      <MenuButton />

      <div
        ref={menuRef}
        style={{ position: "absolute", top: "100%", marginTop: ".25rem" }}
      >
        {/* the zIndex ensures this menu has higher stacking order,
  see https://github.com/excalidraw/excalidraw/pull/1445 */}
        <Island className="menu-container" padding={2}>
          {children}
        </Island>
      </div>
    </>
  );
};

Menu.Item = MenuItem;
Menu.Separator = MenuSeparator;
Menu.LoadScene = MenuComponents.LoadScene;
Menu.SaveToActiveFile = MenuComponents.SaveToActiveFile;
Menu.SaveAsImage = MenuComponents.SaveAsImage;
Menu.Help = MenuComponents.Help;
Menu.ClearCanvas = MenuComponents.ClearCanvas;
Menu.ToggleTheme = MenuComponents.ToggleTheme;
Menu.ChangeCanvasBackground = MenuComponents.ChangeCanvasBackground;

export default Menu;

Menu.displayName = "Menu";
