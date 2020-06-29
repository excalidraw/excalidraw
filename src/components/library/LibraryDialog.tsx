import React, { useState, useEffect } from "react";
import { Dialog } from "../Dialog";
import { t } from "../../i18n";
import { useLibraryStorage, Library } from "./storage";
import SavedDrawingItem from "./SavedDrawingItem";
import "./styles.scss";
import "./styles.css";

export type LibraryDialogProps = {
  onCloseRequest: () => void;
};

export default function LibraryDialog({ onCloseRequest }: LibraryDialogProps) {
  const [library, setLibrary] = useState<Library | null>(null);
  const storage = useLibraryStorage();
  const isLoading = !library;

  useEffect(() => {
    if (!storage) {
      return;
    }
    storage.getLibrary().then(setLibrary);
    const { unsubscribe } = storage.subscribe(() => {
      storage.getLibrary().then(setLibrary);
    });
    return unsubscribe;
  }, [storage, setLibrary]);

  return (
    <Dialog
      className="LibraryDialog"
      title={t("drawingLibrary.dialogTitle")}
      onCloseRequest={onCloseRequest}
    >
      {!isLoading ? (
        <>
          <p style={{ marginTop: 0 }}>
            <em>{t("drawingLibrary.dialogSubtitle")}</em>
          </p>
          <div></div>
          <ul className="SavedDrawingsList">
            {library?.savedDrawings.map((drawing) => (
              <SavedDrawingItem
                dialog={{ onCloseRequest }}
                key={drawing.uid}
                drawing={drawing}
              />
            ))}
          </ul>
        </>
      ) : (
        <>...</>
      )}
    </Dialog>
  );
}
