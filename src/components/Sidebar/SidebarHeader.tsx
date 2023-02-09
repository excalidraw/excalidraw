import clsx from "clsx";
import { useContext } from "react";
import { t } from "../../i18n";
import { useDevice } from "../App";
import { SidebarPropsContext } from "./common";
import { CloseIcon, PinIcon } from "../icons";
import { Tooltip } from "../Tooltip";
import { withInternalFallback } from "../hoc/withInternalFallback";

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
          <div
            className={clsx("Sidebar__pin-btn", {
              "Sidebar__pin-btn--pinned": props.checked,
            })}
            tabIndex={0}
          >
            {PinIcon}
          </div>{" "}
        </label>{" "}
      </Tooltip>
    </div>
  );
};

export const SidebarHeader = withInternalFallback(
  "SidebarHeader",
  ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => {
    const device = useDevice();
    const props = useContext(SidebarPropsContext);

    const renderDockButton = !!(device.canDeviceFitSidebar && props.dockable);
    const renderCloseButton = !!props.onClose;

    return (
      <props.SidebarHeaderTunnel.In>
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
                    props.onDock?.(!props.docked);
                  }}
                />
              )}
              {renderCloseButton && (
                <button
                  data-testid="sidebar-close"
                  className="Sidebar__close-btn"
                  onClick={props.onClose}
                  aria-label={t("buttons.close")}
                >
                  {CloseIcon}
                </button>
              )}
            </div>
          )}
        </div>
      </props.SidebarHeaderTunnel.In>
    );
  },
);
