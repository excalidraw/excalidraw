import { actionClearCanvas, actionPurgeDeletedElements } from "../actions";
import { atom, useAtom } from "../editor-jotai";
import { t } from "../i18n";

import { useExcalidrawActionManager } from "./App";
import ConfirmDialog from "./ConfirmDialog";

export const activeConfirmDialogAtom = atom<"clearCanvas" | "purgeDeletedElements" | null>(null);

export const ActiveConfirmDialog = () => {
  const [activeConfirmDialog, setActiveConfirmDialog] = useAtom(
    activeConfirmDialogAtom,
  );
  const actionManager = useExcalidrawActionManager();

  if (!activeConfirmDialog) {
    return null;
  }

  if (activeConfirmDialog === "clearCanvas") {
    return (
      <ConfirmDialog
        onConfirm={() => {
          actionManager.executeAction(actionClearCanvas);
          setActiveConfirmDialog(null);
        }}
        onCancel={() => setActiveConfirmDialog(null)}
        title={t("clearCanvasDialog.title")}
      >
        <p className="clear-canvas__content"> {t("alerts.clearReset")}</p>
      </ConfirmDialog>
    );
  }

  if (activeConfirmDialog === "purgeDeletedElements") {
    return (
      <ConfirmDialog
        onConfirm={() => {
          actionManager.executeAction(actionPurgeDeletedElements);
          setActiveConfirmDialog(null);
        }}
        onCancel={() => setActiveConfirmDialog(null)}
        title="Purge deleted items"
        confirmText="Purge"
      >
        <p>
          This will permanently remove all deleted elements from the file.
          <br />
          <br />
          <strong>This action cannot be undone:</strong> your undo/redo history will be cleared.
        </p>
      </ConfirmDialog>
    );
  }

  return null;
};
