import React from "react";

import { composeEventHandlers } from "@excalidraw/common";

import * as Portal from "@radix-ui/react-portal";

import { useTunnels } from "../../context/tunnels";
import { useUIAppState } from "../../context/ui-appState";
import DropdownMenuSub from "../dropdownMenu/DropdownMenuSub";

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
      const onClickOutside = device.editor.isMobile
        ? undefined
        : () => setAppState({ openMenu: null });

      return (
        <MainMenuTunnel.In>
          {appState.openMenu === "canvas" && device.editor.isMobile && (
            <Portal.Root
              style={{
                backgroundColor: "rgba(18, 18, 18, 0.2)",
                position: "fixed",
                inset: "0px",
                // zIndex: "var(--zIndex-layerUI)",
              }}
              onClick={() => setAppState({ openMenu: null })}
            />
          )}
          <DropdownMenu open={appState.openMenu === "canvas"}>
            <DropdownMenu.Trigger
              onToggle={() => {
                setAppState({
                  openMenu: appState.openMenu === "canvas" ? null : "canvas",
                });
              }}
              data-testid="main-menu-trigger"
              aria-label="Main menu"
              className="main-menu-trigger"
            >
              {HamburgerMenuIcon}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              sideOffset={device.editor.isMobile ? 20 : undefined}
              className="main-menu-content"
              onClickOutside={onClickOutside}
              onSelect={composeEventHandlers(onSelect, () => {
                setAppState({ openMenu: null });
              })}
              collisionPadding={
                // accounting for
                // - editor footer on desktop
                // - toolbar on mobile
                // we probably don't want the menu to overlay these elements
                !device.editor.isMobile
                  ? { bottom: 90, top: 10 }
                  : { top: 90, bottom: 10 }
              }
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
    Sub: DropdownMenuSub,
    DefaultItems,
  },
);

export default MainMenu;
