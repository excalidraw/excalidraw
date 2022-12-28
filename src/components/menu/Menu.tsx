import React from "react";
import { useOutsideClickHook } from "../../hooks/useOutsideClick";
import { useAtomValue, useSetAtom } from "jotai";
import { isMenuOpenAtom } from "../App";
import { Island } from "../Island";
import MenuItem from "./MenuItem";
import MenuTrigger from "./MenuTrigger";
import MenuSeparator from "./MenuSeparator";
import MenuGroup from "./MenuGroup";
import { getValidMenuChildren } from "./menuUtils";
import { copiedStyles } from "../../actions/actionStyles";

const OpenMenu = ({ children }: { children?: React.ReactNode }) => {
  const setIsMenuOpen = useSetAtom(isMenuOpenAtom);
  const menuRef = useOutsideClickHook(() => {
    setIsMenuOpen(false);
  });

  const menuChildren = getValidMenuChildren(children);

  return (
    <>
      <MenuTrigger />

      <div
        ref={menuRef}
        style={{ position: "absolute", top: "100%", marginTop: ".25rem" }}
      >
        {/* the zIndex ensures this menu has higher stacking order,
  see https://github.com/excalidraw/excalidraw/pull/1445 */}
        <Island className="menu-container" padding={2} style={{ zIndex: 1 }}>
          {menuChildren}
        </Island>
      </div>
    </>
  );
};

const Menu = ({ children }: { children?: React.ReactNode }) => {
  const isMenuOpen = useAtomValue(isMenuOpenAtom);

  if (!isMenuOpen) {
    return <MenuTrigger />;
  }

  return <OpenMenu>{children}</OpenMenu>;
};

Menu.Item = MenuItem;
Menu.Group = MenuGroup;
Menu.Separator = MenuSeparator;

export default Menu;

Menu.displayName = "Menu";
