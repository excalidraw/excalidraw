import React from "react";
import { atom, useAtom } from "jotai";
import {
  useDevice,
  useExcalidrawAppState,
  useExcalidrawSetAppState,
} from "../App";
import DropdownMenu from "../dropdownMenu/DropdownMenu";

import * as DefaultItems from "./DefaultItems";

import { UserList } from "../UserList";
import { t } from "../../i18n";
import { HamburgerMenuIcon } from "../icons";
export const isMenuOpenAtom = atom(false);

const MainMenu = ({ children }: { children?: React.ReactNode }) => {
  const [isMenuOpen, setIsMenuOpen] = useAtom(isMenuOpenAtom);
  const device = useDevice();
  const appState = useExcalidrawAppState();
  const setAppState = useExcalidrawSetAppState();
  const onClickOutside = device.isMobile
    ? undefined
    : () => setIsMenuOpen(false);
  return (
    <DropdownMenu
      open={device.isMobile ? appState.openMenu === "canvas" : isMenuOpen}
    >
      <DropdownMenu.Trigger
        onToggle={() => {
          if (device.isMobile) {
            setAppState({
              openMenu: appState.openMenu === "canvas" ? null : "canvas",
            });
          } else {
            setIsMenuOpen(!isMenuOpen);
          }
        }}
      >
        {HamburgerMenuIcon}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content onClickOutside={onClickOutside}>
        {children}
        {device.isMobile && appState.collaborators.size > 0 && (
          <fieldset className="UserList-Wrapper">
            <legend>{t("labels.collaborators")}</legend>
            <UserList mobile={true} collaborators={appState.collaborators} />
          </fieldset>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};

MainMenu.Trigger = DropdownMenu.Trigger;
MainMenu.Item = DropdownMenu.Item;
MainMenu.Group = DropdownMenu.Group;
MainMenu.Separator = DropdownMenu.Separator;
MainMenu.DefaultItems = DefaultItems;

export default MainMenu;

MainMenu.displayName = "Menu";
