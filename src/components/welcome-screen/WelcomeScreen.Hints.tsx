import { t } from "../../i18n";
import {
  WelcomeScreenHelpArrow,
  WelcomeScreenMenuArrow,
  WelcomeScreenTopToolbarArrow,
} from "../icons";

const MenuHint = ({ children }: { children?: React.ReactNode }) => {
  return (
    <div className="virgil welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--menu">
      {WelcomeScreenMenuArrow}
      <div className="welcome-screen-decor-hint__label">
        {children || t("welcomeScreen.defaults.menuHint")}
      </div>
    </div>
  );
};
MenuHint.displayName = "MenuHint";

const ToolbarHint = ({ children }: { children?: React.ReactNode }) => {
  return (
    <div className="virgil welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--toolbar">
      <div className="welcome-screen-decor-hint__label">
        {children || t("welcomeScreen.defaults.toolbarHint")}
      </div>
      {WelcomeScreenTopToolbarArrow}
    </div>
  );
};
ToolbarHint.displayName = "ToolbarHint";

const HelpHint = ({ children }: { children?: React.ReactNode }) => {
  return (
    <div className="virgil welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--help">
      <div>{children || t("welcomeScreen.defaults.helpHint")}</div>
      {WelcomeScreenHelpArrow}
    </div>
  );
};
HelpHint.displayName = "HelpHint";

export { HelpHint, MenuHint, ToolbarHint };
