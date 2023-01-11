import { actionLoadScene, actionShortcuts } from "../../actions";
import { getShortcutFromShortcutName } from "../../actions/shortcuts";
import { t } from "../../i18n";
import {
  useDevice,
  useExcalidrawActionManager,
  useExcalidrawAppState,
} from "../App";
import { ExcalLogo, HelpIcon, LoadIcon } from "../icons";

const WelcomeScreenMenuItemContent = ({
  icon,
  shortcut,
  children,
}: {
  icon?: JSX.Element;
  shortcut?: string | null;
  children: React.ReactNode;
}) => {
  const device = useDevice();
  return (
    <>
      <div className="welcomeScreen__menuItem__icon">{icon}</div>
      <div className="welcomeScreen__menuItem__text">{children}</div>
      {shortcut && !device.isMobile && (
        <div className="welcomeScreen__menuItem__shortcut">{shortcut}</div>
      )}
    </>
  );
};
WelcomeScreenMenuItemContent.displayName = "WelcomeScreenMenuItemContent";

const WelcomeScreenMenuItem = ({
  onSelect,
  children,
  icon,
  shortcut,
  className = "",
  ...props
}: {
  onSelect: () => void;
  children: React.ReactNode;
  icon?: JSX.Element;
  shortcut?: string | null;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      type="button"
      className={`welcomeScreen__menuItem ${className}`}
      onClick={onSelect}
      {...props}
    >
      <WelcomeScreenMenuItemContent icon={icon} shortcut={shortcut}>
        {children}
      </WelcomeScreenMenuItemContent>
    </button>
  );
};
WelcomeScreenMenuItem.displayName = "WelcomeScreenMenuItem";

const WelcomeScreenMenuItemLink = ({
  children,
  href,
  icon,
  shortcut,
  className = "",
  ...props
}: {
  children: React.ReactNode;
  href: string;
  icon?: JSX.Element;
  shortcut?: string | null;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
  return (
    <a
      className={`welcomeScreen__menuItem ${className}`}
      href={href}
      target="_blank"
      rel="noreferrer"
      {...props}
    >
      <WelcomeScreenMenuItemContent icon={icon} shortcut={shortcut}>
        {children}
      </WelcomeScreenMenuItemContent>
    </a>
  );
};
WelcomeScreenMenuItemLink.displayName = "WelcomeScreenMenuItemLink";

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
      onSelect={() => actionManager.executeAction(actionShortcuts)}
      shortcut="?"
      icon={HelpIcon}
    >
      {t("helpDialog.title")}
    </WelcomeScreenMenuItem>
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
      onSelect={() => actionManager.executeAction(actionLoadScene)}
      shortcut={getShortcutFromShortcutName("loadScene")}
      icon={LoadIcon}
    >
      {t("buttons.load")}
    </WelcomeScreenMenuItem>
  );
};
MenuItemLoadScene.displayName = "MenuItemLoadScene";

// -----------------------------------------------------------------------------

Center.Logo = Logo;
Center.Heading = Heading;
Center.Menu = Menu;
Center.MenuItem = WelcomeScreenMenuItem;
Center.MenuItemLink = WelcomeScreenMenuItemLink;
Center.MenuItemHelp = MenuItemHelp;
Center.MenuItemLoadScene = MenuItemLoadScene;

export { Center };
