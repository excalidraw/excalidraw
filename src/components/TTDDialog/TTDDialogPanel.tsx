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
  onTextSubmitInProgess?: boolean;
}

export const TTDDialogPanel = ({
  label,
  children,
  panelAction,
  onTextSubmitInProgess,
}: TTDDialogPanelProps) => {
  return (
    <div className="ttd-dialog-panel">
      <label>{label}</label>
      {children}
      <div
        className={clsx("ttd-dialog-panel-button-container", {
          invisible: !panelAction,
        })}
      >
        <Button
          className="ttd-dialog-panel-button"
          onSelect={panelAction ? panelAction.action : () => {}}
          disabled={onTextSubmitInProgess}
        >
          <div className={clsx({ invisible: onTextSubmitInProgess })}>
            {panelAction?.label}
            {panelAction?.icon && <span>{panelAction.icon}</span>}
          </div>
          {onTextSubmitInProgess && <Spinner />}
        </Button>
      </div>
    </div>
  );
};
