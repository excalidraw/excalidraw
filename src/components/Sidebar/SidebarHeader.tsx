import clsx from "clsx";
import { useContext } from "react";
import { t } from "../../i18n";
import { useDevice } from "../App";
import { SidebarPropsContext } from "./common";
import { close } from "../icons";
import { withUpstreamOverride } from "../hoc/withUpstreamOverride";
import { Tooltip } from "../Tooltip";

const SIDE_LIBRARY_TOGGLE_ICON = (
  <svg viewBox="0 0 24 24" fill="#ffffff">
    <path d="M19 22H5a3 3 0 01-3-3V5a3 3 0 013-3h14a3 3 0 013 3v14a3 3 0 01-3 3zm0-18h-9v16h9a1.01 1.01 0 001-1V5a1.01 1.01 0 00-1-1z"></path>
  </svg>
);

export const SidebarDockButton = (props: {
  checked: boolean;
  onChange?(): void;
}) => {
  return (
    <div className="layer-ui__sidebar-dock-button" data-testid="sidebar-dock">
      <Tooltip label={t("labels.sidebarLock")}>
        <label
          className={clsx(
            "ToolIcon ToolIcon__lock ToolIcon_type_floating",
            `ToolIcon_size_medium`,
          )}
        >
          <input
            className="ToolIcon_type_checkbox"
            type="checkbox"
            onChange={props.onChange}
            checked={props.checked}
            aria-label={t("labels.sidebarLock")}
          />{" "}
          <div className="ToolIcon__icon" tabIndex={0}>
            {SIDE_LIBRARY_TOGGLE_ICON}
          </div>{" "}
        </label>{" "}
      </Tooltip>
    </div>
  );
};

const _SidebarHeader: React.FC<{
  children?: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const device = useDevice();
  const props = useContext(SidebarPropsContext);

  const renderDockButton = !!(device.canDeviceFitSidebar && props.dockable);
  const renderCloseButton = !!props.onClose;

  return (
    <div
      className={clsx("layer-ui__sidebar__header", className)}
      data-testid="sidebar-header"
    >
      {children}
      {(renderDockButton || renderCloseButton) && (
        <div className="layer-ui__sidebar__header__buttons">
          {renderDockButton && (
            <SidebarDockButton
              checked={!!props.docked}
              onChange={() => {
                document
                  .querySelector(".layer-ui__wrapper")
                  ?.classList.add("animate");

                props.onDock?.(!props.docked);
              }}
            />
          )}
          {renderCloseButton && (
            <div className="ToolIcon__icon__close" data-testid="sidebar-close">
              <button
                className="Modal__close"
                onClick={props.onClose}
                aria-label={t("buttons.close")}
              >
                {close}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const [Context, Component] = withUpstreamOverride(_SidebarHeader);

/** @private */
export const SidebarHeaderComponents = { Context, Component };
