import { t } from "../../i18n";
import {
  WelcomeScreenHelpArrow,
  WelcomeScreenMenuArrow,
  WelcomeScreenTopToolbarArrow,
} from "../icons";
import {
  welcomeScreenMenuHint,
  welcomeScreenToolbarHint,
  welcomeScreenHelpHint,
} from "../LayerUI";

const MenuHint = ({ children }: { children?: React.ReactNode }) => {
  return (
    <welcomeScreenMenuHint.In>
      <div className="virgil welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--menu">
        {WelcomeScreenMenuArrow}
        <div className="welcome-screen-decor-hint__label">
          {children || t("welcomeScreen.defaults.menuHint")}
        </div>
      </div>
    </welcomeScreenMenuHint.In>
  );
};
MenuHint.displayName = "MenuHint";

const ToolbarHint = ({ children }: { children?: React.ReactNode }) => {
  return (
    <welcomeScreenToolbarHint.In>
      <div className="virgil welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--toolbar">
        <div className="welcome-screen-decor-hint__label">
          {children || t("welcomeScreen.defaults.toolbarHint")}
        </div>
        {WelcomeScreenTopToolbarArrow}
      </div>
    </welcomeScreenToolbarHint.In>
  );
};
ToolbarHint.displayName = "ToolbarHint";

const HelpHint = ({ children }: { children?: React.ReactNode }) => {
  return (
    <welcomeScreenHelpHint.In>
      <div className="virgil welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--help">
        <div>{children || t("welcomeScreen.defaults.helpHint")}</div>
        {WelcomeScreenHelpArrow}
      </div>
    </welcomeScreenHelpHint.In>
  );
};
HelpHint.displayName = "HelpHint";

export { HelpHint, MenuHint, ToolbarHint };
