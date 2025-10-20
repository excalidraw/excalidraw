import React from "react";

import { composeEventHandlers } from "@excalidraw/common";

import { useTunnels } from "../../context/tunnels";
import { useUIAppState } from "../../context/ui-appState";
import { t } from "../../i18n";
import { useDevice, useExcalidrawSetAppState } from "../App";
import { UserList } from "../UserList";
import DropdownMenu from "../dropdownMenu/DropdownMenu";
import { withInternalFallback } from "../hoc/withInternalFallback";
import { HamburgerMenuIcon } from "../icons";

import * as DefaultItems from "./DefaultItems";

const MainMenu = Object.assign(
  withInternalFallback(
    "MainMenu",
    ({
      children,
      onSelect,
    }: {
      children?: React.ReactNode;
      /**
       * Called when any menu item is selected (clicked on).
       */
      onSelect?: (event: Event) => void;
    }) => {
      const { MainMenuTunnel } = useTunnels();
      const device = useDevice();
      const appState = useUIAppState();
      const setAppState = useExcalidrawSetAppState();

      return (
        <MainMenuTunnel.In>
          <DropdownMenu open={appState.openMenu === "canvas"}>
            <DropdownMenu.Trigger
              onToggle={() => {
                setAppState({
                  openMenu: appState.openMenu === "canvas" ? null : "canvas",
                  openPopup: null,
                  openDialog: null,
                });
              }}
              data-testid="main-menu-trigger"
              className="main-menu-trigger"
            >
              {HamburgerMenuIcon}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              onClickOutside={() => setAppState({ openMenu: null })}
              onSelect={composeEventHandlers(onSelect, () => {
                setAppState({ openMenu: null });
              })}
              placement="bottom"
              className={device.editor.isMobile ? "main-menu-dropdown" : ""}
            >
              {children}
              {device.editor.isMobile && appState.collaborators.size > 0 && (
                <fieldset className="UserList-Wrapper">
                  <legend>{t("labels.collaborators")}</legend>
                  <UserList
                    mobile={true}
                    collaborators={appState.collaborators}
                    userToFollow={appState.userToFollow?.socketId || null}
                  />
                </fieldset>
              )}
            </DropdownMenu.Content>
          </DropdownMenu>
        </MainMenuTunnel.In>
      );
    },
  ),
  {
    Trigger: DropdownMenu.Trigger,
    Item: DropdownMenu.Item,
    ItemLink: DropdownMenu.ItemLink,
    ItemCustom: DropdownMenu.ItemCustom,
    Group: DropdownMenu.Group,
    Separator: DropdownMenu.Separator,
    DefaultItems,
  },
);

export default MainMenu;
