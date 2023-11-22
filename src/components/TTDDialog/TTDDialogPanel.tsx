import { ReactNode } from "react";
import { Button } from "../Button";
import clsx from "clsx";

interface TTDDialogPanelProps {
  label: string;
  children: ReactNode;
  panelAction?: {
    label: string;
    action: () => void;
    icon?: ReactNode;
  };
}

export const TTDDialogPanel = ({
  label,
  children,
  panelAction,
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
        >
          {panelAction?.label}
          {panelAction?.icon && <span>{panelAction.icon}</span>}
        </Button>
      </div>
    </div>
  );
};
