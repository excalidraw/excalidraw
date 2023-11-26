import { ReactNode } from "react";
import { Button } from "../Button";
import clsx from "clsx";
import Spinner from "../Spinner";

interface TTDDialogPanelProps {
  label: string;
  children: ReactNode;
  panelAction?: {
    label: string;
    action: () => void;
    icon?: ReactNode;
  };
  panelActionDisabled?: boolean;
  onTextSubmitInProgess?: boolean;
  renderTopRight?: () => ReactNode;
  renderBottomRight?: () => ReactNode;
}

export const TTDDialogPanel = ({
  label,
  children,
  panelAction,
  panelActionDisabled = false,
  onTextSubmitInProgess,
  renderTopRight,
  renderBottomRight,
}: TTDDialogPanelProps) => {
  return (
    <div className="ttd-dialog-panel">
      <div className="ttd-dialog-panel__header">
        <label>{label}</label>
        {renderTopRight?.()}
      </div>

      {children}
      <div
        className={clsx("ttd-dialog-panel-button-container", {
          invisible: !panelAction,
        })}
        style={{ display: "flex", alignItems: "center" }}
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
        {renderBottomRight?.()}
      </div>
    </div>
  );
};
