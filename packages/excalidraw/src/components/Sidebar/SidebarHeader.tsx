import clsx from "clsx";
import { useContext } from "react";

import { t } from "../../i18n";
import { useDevice } from "../App";
import { Button } from "../Button";
import { Tooltip } from "../Tooltip";
import { CloseIcon, PinIcon } from "../icons";

import { SidebarPropsContext } from "./common";

export const SidebarHeader = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => {
  const device = useDevice();
  const props = useContext(SidebarPropsContext);

  const renderDockButton = !!(
    device.editor.canFitSidebar && props.shouldRenderDockButton
  );

  return (
    <div
      className={clsx("sidebar__header", className)}
      data-testid="sidebar-header"
    >
      {children}
      <div className="sidebar__header__buttons">
        {renderDockButton && (
          <Tooltip label={t("labels.sidebarLock")}>
            <Button
              onSelect={() => props.onDock?.(!props.docked)}
              selected={!!props.docked}
              className="sidebar__dock"
              data-testid="sidebar-dock"
              aria-label={t("labels.sidebarLock")}
            >
              {PinIcon}
            </Button>
          </Tooltip>
        )}
        <Button
          data-testid="sidebar-close"
          className="sidebar__close"
          onSelect={props.onCloseRequest}
          aria-label={t("buttons.close")}
        >
          {CloseIcon}
        </Button>
      </div>
    </div>
  );
};

SidebarHeader.displayName = "SidebarHeader";
