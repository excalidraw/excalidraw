import { useTunnels } from "../../context/tunnels";
import { t } from "../../i18n";
import {
  WelcomeScreenHelpArrow,
  WelcomeScreenMenuArrow,
  WelcomeScreenTopToolbarArrow,
} from "../icons";

const MenuHint = ({ children }: { children?: React.ReactNode }) => {
  const { WelcomeScreenMenuHintTunnel } = useTunnels();
  return (
    <WelcomeScreenMenuHintTunnel.In>
      <div className="excalifont welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--menu">
        {WelcomeScreenMenuArrow}
        <div className="welcome-screen-decor-hint__label">
          {children || t("welcomeScreen.defaults.menuHint")}
        </div>
      </div>
    </WelcomeScreenMenuHintTunnel.In>
  );
};
MenuHint.displayName = "MenuHint";

const ToolbarHint = ({ children }: { children?: React.ReactNode }) => {
  const { WelcomeScreenToolbarHintTunnel } = useTunnels();
  return (
    <WelcomeScreenToolbarHintTunnel.In>
      <div className="excalifont welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--toolbar">
        <div className="welcome-screen-decor-hint__label">
          {children || t("welcomeScreen.defaults.toolbarHint")}
        </div>
        {WelcomeScreenTopToolbarArrow}
      </div>
    </WelcomeScreenToolbarHintTunnel.In>
  );
};
ToolbarHint.displayName = "ToolbarHint";

const renderHintWithKbd = (hint: string) =>
  hint.split(/(<kbd>[^<]+<\/kbd>)/g).map((part, index) => {
    if (index % 2 === 1) {
      const shortcutMatch =
        part[0] === "<" && part.match(/^<kbd>([^<]+)<\/kbd>$/);
      return <kbd key={index}>{shortcutMatch ? shortcutMatch[1] : part}</kbd>;
    }
    return part;
  });

const SelectionToolHint = ({ children }: { children?: React.ReactNode }) => {
  const { WelcomeScreenSelectionToolHintTunnel } = useTunnels();
  return (
    <WelcomeScreenSelectionToolHintTunnel.In>
      <div className="excalifont welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--selectionTool">
        <div className="welcome-screen-decor-hint__label">
          {children ||
            renderHintWithKbd(t("welcomeScreen.defaults.selectionToolHint"))}
        </div>
        {WelcomeScreenTopToolbarArrow}
      </div>
    </WelcomeScreenSelectionToolHintTunnel.In>
  );
};
SelectionToolHint.displayName = "SelectionToolHint";

const HelpHint = ({ children }: { children?: React.ReactNode }) => {
  const { WelcomeScreenHelpHintTunnel } = useTunnels();
  return (
    <WelcomeScreenHelpHintTunnel.In>
      <div className="excalifont welcome-screen-decor welcome-screen-decor-hint welcome-screen-decor-hint--help">
        <div>{children || t("welcomeScreen.defaults.helpHint")}</div>
        {WelcomeScreenHelpArrow}
      </div>
    </WelcomeScreenHelpHintTunnel.In>
  );
};
HelpHint.displayName = "HelpHint";

export { HelpHint, MenuHint, SelectionToolHint, ToolbarHint };
