import clsx from "clsx";
import { getShortcutKey } from "@excalidraw/excalidraw/shortcut";

interface TTDDialogSubmitShortcutProps {
  variant?: "enter" | "ctrlEnter";
  disabled?: boolean;
}

export const TTDDialogSubmitShortcut = ({
  variant = "ctrlEnter",
  disabled = false,
}: TTDDialogSubmitShortcutProps) => {
  return (
    <div className={clsx("ttd-dialog-submit-shortcut", { disabled })}>
      <span className="ttd-dialog-submit-shortcut__label">or</span>
      {variant === "ctrlEnter" ? (
        <>
          <div className="ttd-dialog-submit-shortcut__key">
            {getShortcutKey("CtrlOrCmd")}
          </div>
          <div className="ttd-dialog-submit-shortcut__key">
            {getShortcutKey("Enter")}
          </div>
        </>
      ) : (
        <div className="ttd-dialog-submit-shortcut__key">
          {getShortcutKey("Enter")}
        </div>
      )}
    </div>
  );
};
