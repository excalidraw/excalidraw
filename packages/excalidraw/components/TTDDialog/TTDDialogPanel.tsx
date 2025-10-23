import clsx from "clsx";

import { Button } from "../Button";
import Spinner from "../Spinner";

import type { ReactNode } from "react";

interface TTDDialogPanelProps {
  label: string | ReactNode;
  children: ReactNode;
  panelAction?: {
    label: string;
    action: () => void;
    icon?: ReactNode;
  };
  panelActionDisabled?: boolean;
  onTextSubmitInProgess?: boolean;
  renderTopRight?: () => ReactNode;
  renderSubmitShortcut?: () => ReactNode;
  renderBottomRight?: () => ReactNode;
  className?: string;
}

export const TTDDialogPanel = ({
  label,
  children,
  panelAction,
  panelActionDisabled = false,
  onTextSubmitInProgess,
  renderTopRight,
  renderSubmitShortcut,
  renderBottomRight,
  className,
}: TTDDialogPanelProps) => {
  return (
    <div className={clsx("ttd-dialog-panel", className)}>
      <div className="ttd-dialog-panel__header">
        {typeof label === "string" ? <label>{label}</label> : label}
        {renderTopRight?.()}
      </div>
      {children}
      {panelAction && (
        <div
          className={clsx("ttd-dialog-panel-button-container", {
            invisible: !panelAction,
          })}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <Button
            className="ttd-dialog-panel-button"
            onSelect={panelAction ? panelAction.action : () => {}}
            disabled={panelActionDisabled || onTextSubmitInProgess}
          >
            <div className={clsx({ invisible: onTextSubmitInProgess })}>
              {panelAction?.label}
              {panelAction?.icon && <span>{panelAction.icon}</span>}
            </div>
            {onTextSubmitInProgess && <Spinner />}
          </Button>
          {!panelActionDisabled &&
            !onTextSubmitInProgess &&
            renderSubmitShortcut?.()}
          {renderBottomRight?.()}
        </div>
      )}
    </div>
  );
};
