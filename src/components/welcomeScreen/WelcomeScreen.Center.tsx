import { actionLoadScene, actionShortcuts } from "../../actions";
import { getShortcutFromShortcutName } from "../../actions/shortcuts";
import { t } from "../../i18n";
import { useExcalidrawActionManager, useExcalidrawAppState } from "../App";
import { ExcalLogo, HelpIcon, LoadIcon } from "../icons";

const WelcomeScreenMenuItem = ({
  label,
  shortcut,
  onClick,
  icon,
  link,
}: {
  label: string;
  shortcut: string | null;
  onClick?: () => void;
  icon: JSX.Element;
  link?: string;
}) => {
  if (link) {
    return (
      <a
        className="welcomeScreen__menuItem"
        href={link}
        target="_blank"
        rel="noreferrer"
      >
        <div className="welcomeScreen__menuItem__label">
          {icon}
          {label}
        </div>
      </a>
    );
  }

  return (
    <button className="welcomeScreen__menuItem" type="button" onClick={onClick}>
      <div className="welcomeScreen__menuItem__label">
        {icon}
        {label}
      </div>
      {shortcut && (
        <div className="welcomeScreen__menuItem__shortcut">{shortcut}</div>
      )}
    </button>
  );
};

const Center = ({ children }: { children?: React.ReactNode }) => {
  return (
    <div className="welcomeScreen__center">
      {children || (
        <>
          <Logo />
          <Heading>{t("welcomeScreen.defaults.center_heading")}</Heading>
          <Menu>
            <MenuItemLoadScene />
            <MenuItemHelp />
          </Menu>
        </>
      )}
    </div>
  );
};
Center.displayName = "Center";

const Logo = ({ children }: { children?: React.ReactNode }) => {
  return (
    <div className="welcomeScreen__center__logo virgil welcomeScreen-decor">
      {children || <>{ExcalLogo} Excalidraw</>}
    </div>
  );
};
Logo.displayName = "Logo";

const Heading = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="welcomeScreen__center__heading welcomeScreen-decor virgil">
      {children}
    </div>
  );
};
Heading.displayName = "Heading";

const Menu = ({ children }: { children?: React.ReactNode }) => {
  return <div className="welcomeScreen__menu">{children}</div>;
};
Menu.displayName = "Menu";

const MenuItemHelp = () => {
  const actionManager = useExcalidrawActionManager();

  return (
    <WelcomeScreenMenuItem
      onClick={() => actionManager.executeAction(actionShortcuts)}
      label={t("helpDialog.title")}
      shortcut="?"
      icon={HelpIcon}
    />
  );
};
MenuItemHelp.displayName = "MenuItemHelp";

const MenuItemLoadScene = () => {
  const appState = useExcalidrawAppState();
  const actionManager = useExcalidrawActionManager();

  if (appState.viewModeEnabled) {
    return null;
  }

  return (
    <WelcomeScreenMenuItem
      label={t("buttons.load")}
      onClick={() => actionManager.executeAction(actionLoadScene)}
      shortcut={getShortcutFromShortcutName("loadScene")}
      icon={LoadIcon}
    />
  );
};
MenuItemLoadScene.displayName = "MenuItemLoadScene";

// -----------------------------------------------------------------------------

Center.Logo = Logo;
Center.Heading = Heading;
Center.Menu = Menu;
Center.MenuItem = WelcomeScreenMenuItem;
Center.MenuItemHelp = MenuItemHelp;
Center.MenuItemLoadScene = MenuItemLoadScene;

export { Center };
