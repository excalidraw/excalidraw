import { t } from "../../i18n";
import {
  WelcomeScreenHelpArrow,
  WelcomeScreenMenuArrow,
  WelcomeScreenTopToolbarArrow,
} from "../icons";

const MenuHint = ({ children }: { children?: React.ReactNode }) => {
  return (
    <div className="virgil welcomeScreen-decor welcomeScreen-decor-hint welcomeScreen-decor-hint--menu">
      {WelcomeScreenMenuArrow}
      <div className="welcomeScreen-decor-hint__label">
        {children || t("welcomeScreen.defaults.menuHint")}
      </div>
    </div>
  );
};
MenuHint.displayName = "MenuHint";

const ToolbarHint = () => {
  return (
    <div className="virgil welcomeScreen-decor welcomeScreen-decor-hint welcomeScreen-decor-hint--toolbar">
      <div className="welcomeScreen-decor-hint__label">
        {t("welcomeScreen.defaults.toolbarHint")}
      </div>
      {WelcomeScreenTopToolbarArrow}
    </div>
  );
};
ToolbarHint.displayName = "ToolbarHint";

const HelpHint = () => {
  return (
    <div className="virgil welcomeScreen-decor welcomeScreen-decor-hint welcomeScreen-decor-hint--help">
      <div>{t("welcomeScreen.defaults.helpHint")}</div>
      {WelcomeScreenHelpArrow}
    </div>
  );
};
HelpHint.displayName = "HelpHint";

export { HelpHint, MenuHint, ToolbarHint };
