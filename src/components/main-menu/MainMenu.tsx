import React from "react";
import {
  useDevice,
  useExcalidrawSetAppState,
  useExcalidrawAppState,
} from "../App";
import DropdownMenu from "../dropdownMenu/DropdownMenu";

import * as DefaultItems from "./DefaultItems";

import { UserList } from "../UserList";
import { t } from "../../i18n";
import { HamburgerMenuIcon } from "../icons";
import { withInternalFallback } from "../hoc/withInternalFallback";
import { composeEventHandlers } from "../../utils";
import { useTunnels } from "../../context/tunnels";
import { useUIAppState } from "../../context/ui-appState";
import FileName from "../fileName/fileName";

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
      const excaliAppState = useExcalidrawAppState();
      const onClickOutside = device.isMobile
        ? undefined
        : () => setAppState({ openMenu: null });

      return (
        <MainMenuTunnel.In>
          <div className="fileNameFlexBox">
            <DropdownMenu open={appState.openMenu === "canvas"}>
              <DropdownMenu.Trigger
                onToggle={() => {
                  setAppState({
                    openMenu: appState.openMenu === "canvas" ? null : "canvas",
                  });
                }}
                data-testid="main-menu-trigger"
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
            {excaliAppState.fileHandle !== null && !device.isMobile ? (
              <span>
                <FileName name={excaliAppState.fileHandle.name}></FileName>
              </span>
            ) : null}
          </div>
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
