import React, { useCallback, useState } from "react";
import { saveLibraryAsJSON } from "../data/json";
import Library, { libraryItemsAtom } from "../data/library";
import { t } from "../i18n";
import { AppState, LibraryItem, LibraryItems } from "../types";
import { exportToFileIcon, load, publishIcon, trash } from "./icons";
import { ToolButton } from "./ToolButton";
import { Tooltip } from "./Tooltip";
import { fileOpen } from "../data/filesystem";
import { muteFSAbortError } from "../utils";
import { useAtom } from "jotai";
import { jotaiScope } from "../jotai";
import ConfirmDialog from "./ConfirmDialog";
import PublishLibrary from "./PublishLibrary";
import { Dialog } from "./Dialog";

const getSelectedItems = (
  libraryItems: LibraryItems,
  selectedItems: LibraryItem["id"][],
) => libraryItems.filter((item) => selectedItems.includes(item.id));

export const LibraryMenuHeader: React.FC<{
  setAppState: React.Component<any, AppState>["setState"];
  selectedItems: LibraryItem["id"][];
  library: Library;
  onRemoveFromLibrary: () => void;
  resetLibrary: () => void;
  onSelectItems: (items: LibraryItem["id"][]) => void;
  appState: AppState;
}> = ({
  setAppState,
  selectedItems,
  library,
  onRemoveFromLibrary,
  resetLibrary,
  onSelectItems,
  appState,
}) => {
  const [libraryItemsData] = useAtom(libraryItemsAtom, jotaiScope);

  const renderRemoveLibAlert = useCallback(() => {
    const content = selectedItems.length
      ? t("alerts.removeItemsFromsLibrary", { count: selectedItems.length })
      : t("alerts.resetLibrary");
    const title = selectedItems.length
      ? t("confirmDialog.removeItemsFromLib")
      : t("confirmDialog.resetLibrary");
    return (
      <ConfirmDialog
        onConfirm={() => {
          if (selectedItems.length) {
            onRemoveFromLibrary();
          } else {
            resetLibrary();
          }
          setShowRemoveLibAlert(false);
        }}
        onCancel={() => {
          setShowRemoveLibAlert(false);
        }}
        title={title}
      >
        <p>{content}</p>
      </ConfirmDialog>
    );
  }, [selectedItems, onRemoveFromLibrary, resetLibrary]);

  const [showRemoveLibAlert, setShowRemoveLibAlert] = useState(false);

  const itemsSelected = !!selectedItems.length;
  const items = itemsSelected
    ? libraryItemsData.libraryItems.filter((item) =>
        selectedItems.includes(item.id),
      )
    : libraryItemsData.libraryItems;
  const resetLabel = itemsSelected
    ? t("buttons.remove")
    : t("buttons.resetLibrary");

  const [showPublishLibraryDialog, setShowPublishLibraryDialog] =
    useState(false);
  const [publishLibSuccess, setPublishLibSuccess] = useState<null | {
    url: string;
    authorName: string;
  }>(null);
  const renderPublishSuccess = useCallback(() => {
    return (
      <Dialog
        onCloseRequest={() => setPublishLibSuccess(null)}
        title={t("publishSuccessDialog.title")}
        className="publish-library-success"
        small={true}
      >
        <p>
          {t("publishSuccessDialog.content", {
            authorName: publishLibSuccess!.authorName,
          })}{" "}
          <a
            href={publishLibSuccess?.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("publishSuccessDialog.link")}
          </a>
        </p>
        <ToolButton
          type="button"
          title={t("buttons.close")}
          aria-label={t("buttons.close")}
          label={t("buttons.close")}
          onClick={() => setPublishLibSuccess(null)}
          data-testid="publish-library-success-close"
          className="publish-library-success-close"
        />
      </Dialog>
    );
  }, [setPublishLibSuccess, publishLibSuccess]);

  const onPublishLibSuccess = useCallback(
    (data: { url: string; authorName: string }, libraryItems: LibraryItems) => {
      setShowPublishLibraryDialog(false);
      setPublishLibSuccess({ url: data.url, authorName: data.authorName });
      const nextLibItems = libraryItems.slice();
      nextLibItems.forEach((libItem) => {
        if (selectedItems.includes(libItem.id)) {
          libItem.status = "published";
        }
      });
      library.setLibrary(nextLibItems);
    },
    [setShowPublishLibraryDialog, setPublishLibSuccess, selectedItems, library],
  );

  const onLibraryImport = async () => {
    try {
      await library.updateLibrary({
        libraryItems: fileOpen({
          description: "Excalidraw library files",
          // ToDo: Be over-permissive until https://bugs.webkit.org/show_bug.cgi?id=34442
          // gets resolved. Else, iOS users cannot open `.excalidraw` files.
          /*
            extensions: [".json", ".excalidrawlib"],
            */
        }),
        merge: true,
        openLibraryMenu: true,
      });
    } catch (error: any) {
      if (error?.name === "AbortError") {
        console.warn(error);
        return;
      }
      setAppState({ errorMessage: t("errors.importLibraryError") });
    }
  };

  const onLibraryExport = async () => {
    const libraryItems = itemsSelected
      ? items
      : await library.getLatestLibrary();
    saveLibraryAsJSON(libraryItems)
      .catch(muteFSAbortError)
      .catch((error) => {
        setAppState({ errorMessage: error.message });
      });
  };

  return (
    <div className="library-actions">
      {showRemoveLibAlert && renderRemoveLibAlert()}
      {showPublishLibraryDialog && (
        <PublishLibrary
          onClose={() => setShowPublishLibraryDialog(false)}
          libraryItems={getSelectedItems(
            libraryItemsData.libraryItems,
            selectedItems,
          )}
          appState={appState}
          onSuccess={(data) =>
            onPublishLibSuccess(data, libraryItemsData.libraryItems)
          }
          onError={(error) => window.alert(error)}
          updateItemsInStorage={() =>
            library.setLibrary(libraryItemsData.libraryItems)
          }
          onRemove={(id: string) =>
            onSelectItems(selectedItems.filter((_id) => _id !== id))
          }
        />
      )}
      {publishLibSuccess && renderPublishSuccess()}
      {!itemsSelected && (
        <ToolButton
          key="import"
          type="button"
          title={t("buttons.load")}
          aria-label={t("buttons.load")}
          icon={load}
          onClick={onLibraryImport}
          className="library-actions--load"
        />
      )}
      {!!items.length && (
        <>
          <ToolButton
            key="export"
            type="button"
            title={t("buttons.export")}
            aria-label={t("buttons.export")}
            icon={exportToFileIcon}
            onClick={onLibraryExport}
            className="library-actions--export"
          >
            {selectedItems.length > 0 && (
              <span className="library-actions-counter">
                {selectedItems.length}
              </span>
            )}
          </ToolButton>
          <ToolButton
            key="reset"
            type="button"
            title={resetLabel}
            aria-label={resetLabel}
            icon={trash}
            onClick={() => setShowRemoveLibAlert(true)}
            className="library-actions--remove"
          >
            {selectedItems.length > 0 && (
              <span className="library-actions-counter">
                {selectedItems.length}
              </span>
            )}
          </ToolButton>
        </>
      )}
      {itemsSelected && (
        <Tooltip label={t("hints.publishLibrary")}>
          <ToolButton
            type="button"
            aria-label={t("buttons.publishLibrary")}
            label={t("buttons.publishLibrary")}
            icon={publishIcon}
            className="library-actions--publish"
            onClick={() => setShowPublishLibraryDialog(true)}
          >
            <label>{t("buttons.publishLibrary")}</label>
            {selectedItems.length > 0 && (
              <span className="library-actions-counter">
                {selectedItems.length}
              </span>
            )}
          </ToolButton>
        </Tooltip>
      )}
    </div>
  );
};
