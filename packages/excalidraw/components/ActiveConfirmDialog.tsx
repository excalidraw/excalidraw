import { atom, useAtom } from "jotai";
import { actionClearCanvas, actionDeleteSelected } from "../actions";
import { t } from "../i18n";
import { jotaiScope } from "../jotai";
import { useExcalidrawActionManager } from "./App";
import ConfirmDialog from "./ConfirmDialog";

export const activeConfirmDialogAtom = atom<"clearCanvas" | null>(null);
export const showDeleteAlert = atom<"showAlert" | null>(null)

export const ActiveConfirmDialog = () => {
  const [activeConfirmDialog, setActiveConfirmDialog] = useAtom(
    activeConfirmDialogAtom,
    jotaiScope,
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

  return null;
};

export const ShowDeleteAlert = () => {
  const [activeConfirmDialog, setActiveConfirmDialog] = useAtom(
    showDeleteAlert,
    jotaiScope,
  );
  const actionManager = useExcalidrawActionManager();

  if (!activeConfirmDialog) {
    return null;
  }

  if (activeConfirmDialog === "showAlert") {
    return (
      <ConfirmDialog
        onConfirm={() => {
          actionManager.executeAction(actionDeleteSelected, "keyboard");
          setActiveConfirmDialog(null);
        }}
        onCancel={() => setActiveConfirmDialog(null)}
        title={t("deleteElement.title")}
      >
        <p className="clear-canvas__content"> {t("alerts.deleteElement")}</p>
      </ConfirmDialog>
    );
  }

  return null;
};