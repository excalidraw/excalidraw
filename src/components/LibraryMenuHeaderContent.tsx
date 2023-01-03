import React, { useCallback, useState } from "react";
import { saveLibraryAsJSON } from "../data/json";
import Library, { libraryItemsAtom } from "../data/library";
import { t } from "../i18n";
import { AppState, LibraryItem, LibraryItems } from "../types";
import {
  DotsIcon,
  ExportIcon,
  LoadIcon,
  publishIcon,
  TrashIcon,
} from "./icons";
import { ToolButton } from "./ToolButton";
import { fileOpen } from "../data/filesystem";
import { muteFSAbortError } from "../utils";
import { atom, useAtom } from "jotai";
import { jotaiScope } from "../jotai";
import ConfirmDialog from "./ConfirmDialog";
import PublishLibrary from "./PublishLibrary";
import { Dialog } from "./Dialog";

import Menu from "./menu/Menu";

export const isLibraryMenuOpenAtom = atom(false);

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
  const [isLibraryMenuOpen, setIsLibraryMenuOpen] = useAtom(
    isLibraryMenuOpenAtom,
  );
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

  const renderLibraryMenu = () => {
    return (
      <Menu open={isLibraryMenuOpen}>
        <Menu.Trigger
          className="Sidebar__dropdown-btn"
          onClick={() => setIsLibraryMenuOpen(!isLibraryMenuOpen)}
        >
          {DotsIcon}
        </Menu.Trigger>
        <Menu.Content onClickOutside={() => setIsLibraryMenuOpen(false)}>
          {!itemsSelected && (
            <Menu.Item
              onClick={onLibraryImport}
              icon={LoadIcon}
              dataTestId="lib-dropdown--load"
            >
              {t("buttons.load")}
            </Menu.Item>
          )}
          {!!items.length && (
            <Menu.Item
              onClick={onLibraryExport}
              icon={ExportIcon}
              dataTestId="lib-dropdown--export"
            >
              {t("buttons.export")}
            </Menu.Item>
          )}
          {!!items.length && (
            <Menu.Item
              onClick={() => setShowRemoveLibAlert(true)}
              icon={TrashIcon}
            >
              {resetLabel}
            </Menu.Item>
          )}
          {itemsSelected && (
            <Menu.Item
              icon={publishIcon}
              onClick={() => setShowPublishLibraryDialog(true)}
              dataTestId="lib-dropdown--remove"
            >
              {t("buttons.publishLibrary")}
            </Menu.Item>
          )}
        </Menu.Content>
      </Menu>
    );
  };
  return (
    <div style={{ position: "relative" }}>
      {renderLibraryMenu()}
      {selectedItems.length > 0 && (
        <div className="library-actions-counter">{selectedItems.length}</div>
      )}
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
    </div>
  );
};
