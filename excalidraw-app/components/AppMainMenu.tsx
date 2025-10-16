import {
  loginIcon,
  ExcalLogo,
  eyeIcon,
} from "@excalidraw/excalidraw/components/icons";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React, { useCallback } from "react";

import { isDevEnv } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { LanguageList } from "../app-language/LanguageList";
import { isPremiumSignedUser } from "../app_constants";
import { useAuthShell } from "../auth-shell";

import { saveDebugState } from "./DebugCanvas";

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  setTheme: (theme: Theme | "system") => void;
  refresh: () => void;
}> = React.memo((props) => {
  const authShell = useAuthShell();

  const defaultAuthBase = import.meta.env.VITE_APP_PLUS_APP?.trim() ?? "";
  const authBaseUrl =
    import.meta.env.VITE_AUTH_SERVICE_URL?.trim() || defaultAuthBase;

  const normalizeBaseUrl = (baseUrl: string) =>
    baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  const appendUtmParams = (url: string) => {
    const utmSuffix = "utm_source=signin&utm_medium=app&utm_content=hamburger";
    return url.includes("?") ? `${url}&${utmSuffix}` : `${url}?${utmSuffix}`;
  };

  const authPath = isPremiumSignedUser ? "/sign-in" : "/sign-up";
  const authLabel = isPremiumSignedUser ? "Sign in" : "Sign up";

  const baseForHref =
    authBaseUrl && authBaseUrl.length > 0
      ? normalizeBaseUrl(authBaseUrl)
      : defaultAuthBase.length > 0
        ? normalizeBaseUrl(defaultAuthBase)
        : "";

  const authHref =
    baseForHref.length > 0
      ? appendUtmParams(`${baseForHref}${authPath}`)
      : "#";

  const handleSignOut = useCallback(() => {
    if (!authShell) {
      return;
    }

    Promise.resolve(authShell.signOut()).catch((error) => {
      console.error("[AuthShell] Sign out failed", error);
    });
  }, [authShell]);

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
      {authShell ? (
        <MainMenu.Item
          icon={loginIcon}
          onSelect={handleSignOut}
          className="highlighted"
        >
          Sign out
        </MainMenu.Item>
      ) : (
        <MainMenu.ItemLink
          icon={loginIcon}
          href={authHref}
          className="highlighted"
        >
          {authLabel}
        </MainMenu.ItemLink>
      )}
      {isDevEnv() && (
        <MainMenu.Item
          icon={eyeIcon}
          onClick={() => {
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
      <MainMenu.DefaultItems.ToggleTheme
        allowSystemTheme
        theme={props.theme}
        onSelect={props.setTheme}
      />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});
