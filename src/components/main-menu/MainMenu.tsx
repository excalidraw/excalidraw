import React from "react";
import { useDevice, useExcalidrawSetAppState } from "../App";
import DropdownMenu from "../dropdownMenu/DropdownMenu";

import * as DefaultItems from "./DefaultItems";

import { UserList } from "../UserList";
import { t } from "../../i18n";
import { HamburgerMenuIcon } from "../icons";
import { withInternalFallback } from "../hoc/withInternalFallback";
import { composeEventHandlers } from "../../utils";
import { useTunnels } from "../../context/tunnels";
import { useUIAppState } from "../../context/ui-appState";

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
      const onClickOutside = device.isMobile
        ? undefined
        : () => setAppState({ openMenu: null });

      return (
        <MainMenuTunnel.In>
          <DropdownMenu open={appState.openMenu === "canvas"}>
            <DropdownMenu.Trigger
              onToggle={() => {
                setAppState({
                  openMenu: appState.openMenu === "canvas" ? null : "canvas",
                });
              }}
            >
              {HamburgerMenuIcon}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              onClickOutside={onClickOutside}
              onSelect={composeEventHandlers(onSelect, () => {
                setAppState({ openMenu: null });
              })}
            >
              {children}
              {device.isMobile && appState.collaborators.size > 0 && (
                <fieldset className="UserList-Wrapper">
                  <legend>{t("labels.collaborators")}</legend>
                  <UserList
                    mobile={true}
                    collaborators={appState.collaborators}
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
