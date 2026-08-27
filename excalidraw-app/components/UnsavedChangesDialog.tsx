import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";

import "./UnsavedChangesDialog.scss";

export type UnsavedChangesDialogProps = {
  isOpen: boolean;
  collectionName: string;
  onSaveAndContinue: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  busy?: boolean;
};

export const UnsavedChangesDialog = ({
  isOpen,
  collectionName,
  onSaveAndContinue,
  onDiscard,
  onCancel,
  busy = false,
}: UnsavedChangesDialogProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      onCloseRequest={onCancel}
      title="Unsaved changes"
      size="small"
      className="unsaved-changes-dialog"
    >
      <div className="unsaved-changes-dialog__content">
        <p>
          <strong>{collectionName}</strong> has unsaved changes. What would you
          like to do?
        </p>
        <div className="unsaved-changes-dialog__actions">
          <FilledButton
            label="Save & continue"
            onClick={onSaveAndContinue}
            disabled={busy}
          />
          <button
            type="button"
            className="unsaved-changes-dialog__secondary"
            onClick={onDiscard}
            disabled={busy}
          >
            Discard
          </button>
          <button
            type="button"
            className="unsaved-changes-dialog__secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      </div>
    </Dialog>
  );
};
