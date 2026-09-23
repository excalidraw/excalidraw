import clsx from "clsx";

import { Fragment } from "react";

import { Button } from "../Button";
import Spinner from "../Spinner";

import type { ReactNode } from "react";

export type TTDPanelAction = {
  label: string;
  action?: () => void;
  icon?: ReactNode;
  variant: "button" | "link" | "rateLimit";
  disabled?: boolean;
  className?: string;
};

interface TTDDialogPanelProps {
  label?: string | ReactNode;
  children: ReactNode;
  panelActions?: TTDPanelAction[];
  onTextSubmitInProgess?: boolean;
  renderTopRight?: () => ReactNode;
  renderSubmitShortcut?: () => ReactNode;
  className?: string;
  panelActionJustifyContent?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly";
}

export const TTDDialogPanel = ({
  label,
  children,
  panelActions = [],
  onTextSubmitInProgess,
  renderTopRight,
  renderSubmitShortcut,
  className,
  panelActionJustifyContent = "flex-start",
}: TTDDialogPanelProps) => {
  const renderPanelAction = (panelAction: TTDPanelAction) => {
    if (panelAction?.variant === "link") {
      return (
        <button
          className={clsx(
            "ttd-dialog-panel-action-link",
            panelAction.className,
          )}
          onClick={panelAction.action}
          disabled={panelAction?.disabled || onTextSubmitInProgess}
          type="button"
        >
          {panelAction.label}
          {panelAction.icon && (
            <span className="ttd-dialog-panel-action-link__icon">
              {panelAction.icon}
            </span>
          )}
        </button>
      );
    }

    if (panelAction?.variant === "button") {
      return (
        <Button
          className={clsx("ttd-dialog-panel-button", panelAction.className)}
          onSelect={panelAction.action ? panelAction.action : () => {}}
          disabled={panelAction?.disabled || onTextSubmitInProgess}
        >
          <div className={clsx({ invisible: onTextSubmitInProgess })}>
            {panelAction?.label}
            {panelAction?.icon && <span>{panelAction.icon}</span>}
          </div>
          {onTextSubmitInProgess && <Spinner />}
        </Button>
      );
    }

    if (panelAction?.variant === "rateLimit") {
      return (
        <div
          className={clsx(
            "ttd-dialog-panel__rate-limit",
            panelAction.className,
          )}
        >
          {panelAction.label}
        </div>
      );
    }
  };

  return (
    <div className={clsx("ttd-dialog-panel", className)}>
      {(label || renderTopRight) && (
        <div className="ttd-dialog-panel__header">
          {typeof label === "string" ? <label>{label}</label> : label}
          {renderTopRight?.()}
        </div>
      )}
      {children}
      <div
        className={clsx("ttd-dialog-panel-button-container", {
          invisible: !panelActions.length,
        })}
        style={{
          justifyContent: panelActionJustifyContent,
        }}
      >
        {panelActions.filter(Boolean).map((panelAction) => (
          <Fragment key={panelAction.label}>
            {renderPanelAction(panelAction)}
          </Fragment>
        ))}
        {!onTextSubmitInProgess && renderSubmitShortcut?.()}
      </div>
    </div>
  );
};
