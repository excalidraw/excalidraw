import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import React from "react";

export const AppWelcomeScreen: React.FC = React.memo(() => {
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
