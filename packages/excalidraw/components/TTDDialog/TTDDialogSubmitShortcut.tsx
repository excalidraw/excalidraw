import { getShortcutKey } from "@excalidraw/common";

export const TTDDialogSubmitShortcut = () => {
  return (
    <div className="ttd-dialog-submit-shortcut">
      <span className="ttd-dialog-submit-shortcut__label">or</span>
      <div className="ttd-dialog-submit-shortcut__key">
        {getShortcutKey("CtrlOrCmd")}
      </div>
      <div className="ttd-dialog-submit-shortcut__key">
        {getShortcutKey("Enter")}
      </div>
    </div>
  );
};
