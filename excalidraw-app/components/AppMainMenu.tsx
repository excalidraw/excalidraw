import {
  loginIcon,
  ExcalLogo,
  eyeIcon,
  playerPlayIcon,
  usersIcon,
} from "@excalidraw/excalidraw/components/icons";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React from "react";

import { isDevEnv } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { LanguageList } from "../app-language/LanguageList";
import { isExcalidrawPlusSignedUser } from "../app_constants";

import { saveDebugState } from "./DebugCanvas";

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  refresh: () => void;
  // Supabase sync (all gated on `isSupabaseSyncEnabled`; flag-off renders today's
  // menu exactly).
  isSupabaseSyncEnabled?: boolean;
  isSignedIn?: boolean;
  userEmail?: string | null;
  onSyncNow?: () => void;
  onRequestSignIn?: () => void;
  onSignOut?: () => void;
}> = React.memo((props) => {
  return (
    <MainMenu>
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      {props.isCollabEnabled && (
        <MainMenu.DefaultItems.LiveCollaborationTrigger
          isCollaborating={props.isCollaborating}
          onSelect={() => props.onCollabDialogOpen()}
        />
      )}
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      {props.isSupabaseSyncEnabled && (
        <>
          <MainMenu.Item
            icon={playerPlayIcon}
            onSelect={() => props.onSyncNow?.()}
            disabled={!props.isSignedIn}
          >
            Sync now
          </MainMenu.Item>
          {props.isSignedIn ? (
            <>
              {props.userEmail && (
                <MainMenu.Item icon={usersIcon} onSelect={() => {}}>
                  {props.userEmail}
                </MainMenu.Item>
              )}
              <MainMenu.Item
                icon={loginIcon}
                onSelect={() => props.onSignOut?.()}
              >
                Sign out
              </MainMenu.Item>
            </>
          ) : (
            <MainMenu.Item
              icon={loginIcon}
              onSelect={() => props.onRequestSignIn?.()}
            >
              Sign in to sync
            </MainMenu.Item>
          )}
          <MainMenu.Separator />
        </>
      )}
      <MainMenu.ItemLink
        icon={ExcalLogo}
        href={`${
          import.meta.env.VITE_APP_PLUS_LP
        }/plus?utm_source=excalidraw&utm_medium=app&utm_content=hamburger`}
        className=""
      >
        Excalidraw+
      </MainMenu.ItemLink>
      <MainMenu.DefaultItems.Socials />
      <MainMenu.ItemLink
        icon={loginIcon}
        href={`${import.meta.env.VITE_APP_PLUS_APP}${
          isExcalidrawPlusSignedUser ? "" : "/sign-up"
        }?utm_source=signin&utm_medium=app&utm_content=hamburger`}
        className="highlighted"
      >
        {isExcalidrawPlusSignedUser ? "Sign in" : "Sign up"}
      </MainMenu.ItemLink>
      {isDevEnv() && (
        <MainMenu.Item
          icon={eyeIcon}
          onSelect={() => {
            if (window.visualDebug) {
              delete window.visualDebug;
              saveDebugState({ enabled: false });
            } else {
              window.visualDebug = { data: [] };
              saveDebugState({ enabled: true });
            }
            props?.refresh();
          }}
        >
          Visual Debug
        </MainMenu.Item>
      )}
      <MainMenu.Separator />
      <MainMenu.DefaultItems.Preferences />
      <MainMenu.DefaultItems.ToggleTheme allowSystemTheme theme={props.theme} />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});
