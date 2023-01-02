import React from "react";
import { useOutsideClickHook } from "../../hooks/useOutsideClick";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useDevice, useExcalidrawAppState } from "../App";
import { Island } from "../Island";
import MenuTrigger from "./MenuTrigger";
import MenuItem from "./MenuItem";
import MenuSeparator from "./MenuSeparator";
import MenuGroup from "./MenuGroup";
import { getMenuTriggerComponent, getValidMenuChildren } from "./menuUtils";
import * as DefaultItems from "./MenuDefaultItems";

import "./Menu.scss";
import clsx from "clsx";
import Stack from "../Stack";
import { UserList } from "../UserList";
import { t } from "../../i18n";

export const isMenuOpenAtom = atom(false);

const MenuContent = ({ children }: { children?: React.ReactNode }) => {
  const device = useDevice();
  const appState = useExcalidrawAppState();
  const setIsMenuOpen = useSetAtom(isMenuOpenAtom);
  const menuRef = useOutsideClickHook(() => {
    setIsMenuOpen(false);
  });

  const menuChildren = getValidMenuChildren(children);

  return (
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
          {appState.collaborators.size > 0 && (
            <fieldset className="UserList-Wrapper">
              <legend>{t("labels.collaborators")}</legend>
              <UserList mobile={true} collaborators={appState.collaborators} />
            </fieldset>
          )}
        </Stack.Col>
      ) : (
        <Island className="menu-container" padding={2} style={{ zIndex: 1 }}>
          {menuChildren}
        </Island>
      )}
    </div>
  );
};

const Menu = ({ children }: { children?: React.ReactNode }) => {
  const isMenuOpen = useAtomValue(isMenuOpenAtom);
  const MenuTriggerComp = getMenuTriggerComponent(children);
  if (!isMenuOpen) {
    return <>{MenuTriggerComp}</>;
  }

  return (
    <>
      {MenuTriggerComp}
      <MenuContent>{children}</MenuContent>
    </>
  );
};
Menu.Trigger = MenuTrigger;
Menu.Item = MenuItem;
Menu.Group = MenuGroup;
Menu.Separator = MenuSeparator;
Menu.DefaultItems = DefaultItems;
export default Menu;

Menu.displayName = "Menu";
