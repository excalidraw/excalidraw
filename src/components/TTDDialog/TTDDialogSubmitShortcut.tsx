import { getShortcutKey } from "../../utils";

export const TTDDialogSubmitShortcut = () => {
  return (
    <div className="ttd-dialog-submit-shortcut">
      <div className="ttd-dialog-submit-shortcut__key">
        {getShortcutKey("CtrlOrCmd")}
      </div>
      <div className="ttd-dialog-submit-shortcut__key">
        {getShortcutKey("Enter")}
      </div>
    </div>
  );
};
