import React from "react";
import { atom, useAtom } from "jotai";
import { useDevice, useExcalidrawAppState } from "../App";
import Menu from "../menu/Menu";

import * as DefaultItems from "./MenuDefaultItems";

import { UserList } from "../UserList";
import { t } from "../../i18n";
import { HamburgerMenuIcon } from "../icons";
export const isMenuOpenAtom = atom(false);

const HamburgerMenu = ({ children }: { children?: React.ReactNode }) => {
  const [isMenuOpen, setIsMenuOpen] = useAtom(isMenuOpenAtom);
  const device = useDevice();
  const appState = useExcalidrawAppState();

  return (
    <Menu open={isMenuOpen}>
      <Menu.Trigger onClick={() => setIsMenuOpen(!isMenuOpen)}>
        {HamburgerMenuIcon}
      </Menu.Trigger>
      <Menu.Content onClickOutside={() => setIsMenuOpen(false)}>
        {children}
        {device.isMobile && appState.collaborators.size > 0 && (
          <Menu.Item style={{ height: "auto", padding: 0 }}>
            <fieldset className="UserList-Wrapper">
              <legend>{t("labels.collaborators")}</legend>
              <UserList mobile={true} collaborators={appState.collaborators} />
            </fieldset>
          </Menu.Item>
        )}
      </Menu.Content>
    </Menu>
  );
};

HamburgerMenu.Trigger = Menu.Trigger;
HamburgerMenu.Item = Menu.Item;
HamburgerMenu.Group = Menu.Group;
HamburgerMenu.Separator = Menu.Separator;
HamburgerMenu.DefaultItems = DefaultItems;

export default HamburgerMenu;

HamburgerMenu.displayName = "Menu";
