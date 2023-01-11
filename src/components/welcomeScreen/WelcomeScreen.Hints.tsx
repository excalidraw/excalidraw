import { t } from "../../i18n";
import {
  WelcomeScreenHelpArrow,
  WelcomeScreenMenuArrow,
  WelcomeScreenTopToolbarArrow,
} from "../icons";

const MenuHint = ({ children }: { children?: React.ReactNode }) => {
  return (
    <div className="virgil WelcomeScreen-decor WelcomeScreen-decor--menu-pointer">
      {WelcomeScreenMenuArrow}
      <div>{children || t("welcomeScreen.defaults.menuHint")}</div>
    </div>
  );
};
MenuHint.displayName = "MenuHint";

const ToolbarHint = () => {
  return (
    <div className="virgil WelcomeScreen-decor WelcomeScreen-decor--top-toolbar-pointer">
      <div className="WelcomeScreen-decor--top-toolbar-pointer__label">
        {t("welcomeScreen.defaults.toolbarHint")}
      </div>
      {WelcomeScreenTopToolbarArrow}
    </div>
  );
};
ToolbarHint.displayName = "ToolbarHint";

const HelpHint = () => {
  return (
    <div className="virgil WelcomeScreen-decor WelcomeScreen-decor--help-pointer">
      <div>{t("welcomeScreen.defaults.helpHint")}</div>
      {WelcomeScreenHelpArrow}
    </div>
  );
};
HelpHint.displayName = "HelpHint";

export { HelpHint, MenuHint, ToolbarHint };
