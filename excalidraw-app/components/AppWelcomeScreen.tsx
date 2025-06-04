import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import React from "react";

import { useI18n } from "@excalidraw/excalidraw/i18n";

import { isExcalidrawPlusSignedUser } from "../app_constants";

export const AppWelcomeScreen: React.FC = React.memo(() => {
  const { t } = useI18n();

  const headingContent = isExcalidrawPlusSignedUser
    ? t("welcomeScreen.app.center_heading_plus")
        .split(/(Excalidraw\+)/)
        .map((bit, idx) =>
          bit === "Excalidraw+" ? (
            <a
              style={{ textDecoration: "none" }}
              href={`${
                import.meta.env.VITE_APP_PLUS_APP
              }?utm_source=excalidraw&utm_medium=app&utm_content=welcomeScreenSignedInUser`}
              key={idx}
            >
              Excalidraw+
            </a>
          ) : (
            bit
          ),
        )
    : t("welcomeScreen.app.center_heading");

  return (
    <WelcomeScreen>
      {/* <WelcomeScreen.Hints.MenuHint>Add commentMore actions
        {t("welcomeScreen.app.menuHint")}
      </WelcomeScreen.Hints.MenuHint> */}
      <WelcomeScreen.Hints.ToolbarHint />
      
      <WelcomeScreen.Hints.HelpHint />
      <WelcomeScreen.Center>
        <WelcomeScreen.Center.Logo />
        <WelcomeScreen.Center.Heading>
          {"re-envisioning artistic search history"}
        </WelcomeScreen.Center.Heading>
      </WelcomeScreen.Center>
    </WelcomeScreen>
  );
});
