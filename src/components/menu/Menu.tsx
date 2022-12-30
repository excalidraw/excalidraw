import React from "react";
import { useOutsideClickHook } from "../../hooks/useOutsideClick";
import { useAtomValue, useSetAtom } from "jotai";
import { isMenuOpenAtom, useDevice } from "../App";
import { Island } from "../Island";
import MenuItem from "./MenuItem";
import MenuTrigger from "./MenuTrigger";
import MenuSeparator from "./MenuSeparator";
import MenuGroup from "./MenuGroup";
import { getValidMenuChildren } from "./menuUtils";
import * as DefaultItems from "./MenuDefaultItems";

import "./Menu.scss";
import clsx from "clsx";
import Stack from "../Stack";

const OpenMenu = ({ children }: { children?: React.ReactNode }) => {
  const device = useDevice();

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
        className={clsx("menu", {
          "menu--mobile": device.isMobile,
        })}
        data-testid="menu"
      >
        {/* the zIndex ensures this menu has higher stacking order,
  see https://github.com/excalidraw/excalidraw/pull/1445 */}
        {device.isMobile ? (
          <Stack.Col className="menu-container" gap={2}>
            {menuChildren}
          </Stack.Col>
        ) : (
          <Island className="menu-container" padding={2} style={{ zIndex: 1 }}>
            {menuChildren}
          </Island>
        )}
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
Menu.DefaultItems = DefaultItems;
export default Menu;

Menu.displayName = "Menu";
