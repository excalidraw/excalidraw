import * as Switch from "@radix-ui/react-switch";
import clsx from "clsx";

import type { ReactNode, KeyboardEvent } from "react";

interface TTDDialogPanelSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  leftLabel: ReactNode;
  rightLabel: ReactNode;
  ariaLabel?: string;
}

export const TTDDialogPanelSwitch = ({
  checked,
  onCheckedChange,
  leftLabel,
  rightLabel,
  ariaLabel = "Toggle between options",
}: TTDDialogPanelSwitchProps) => {
  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    value: boolean,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onCheckedChange(value);
    }
  };

  return (
    <div className="ttd-dialog-panel-switch-container" role="group">
      <button
        type="button"
        className={clsx("ttd-dialog-panel-switch-label", {
          "ttd-dialog-panel-switch-label--active": !checked,
        })}
        onClick={() => onCheckedChange(false)}
        onKeyDown={(e) => handleKeyDown(e, false)}
        aria-pressed={!checked}
        tabIndex={0}
      >
        {leftLabel}
      </button>
      <Switch.Root
        className="ttd-dialog-panel-switch-root"
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={ariaLabel}
      >
        <Switch.Thumb className="ttd-dialog-panel-switch-thumb" />
      </Switch.Root>
      <button
        type="button"
        className={clsx("ttd-dialog-panel-switch-label", {
          "ttd-dialog-panel-switch-label--active": checked,
        })}
        onClick={() => onCheckedChange(true)}
        onKeyDown={(e) => handleKeyDown(e, true)}
        aria-pressed={checked}
        tabIndex={0}
      >
        {rightLabel}
      </button>
    </div>
  );
};

TTDDialogPanelSwitch.displayName = "TTDDialogPanelSwitch";
