import { forwardRef, useImperativeHandle, useRef } from "react";
import { t } from "../../packages/excalidraw/i18n";
import { getShortcutKey } from "../../packages/excalidraw/utils";

export type SaveWarningRef = {
  activity: () => Promise<void>;
};

export const SaveWarning = forwardRef<SaveWarningRef, {}>((props, ref) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useImperativeHandle(ref, () => ({
    /**
     * Call this API method via the ref to hide warning message
     * and start an idle timer again.
     */
    activity: async () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        dialogRef.current?.classList.remove("animate");
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        dialogRef.current?.classList.add("animate");
      }, 5000);
    },
  }));

  return (
    <div ref={dialogRef} className="alert-save">
      <div className="dialog">
        {t("alerts.saveYourContent", {
          shortcut: getShortcutKey("CtrlOrCmd + S"),
        })}
      </div>
    </div>
  );
});
