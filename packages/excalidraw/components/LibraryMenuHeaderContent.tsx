import { useCallback, useState } from "react";
import { t } from "../i18n";
import Trans from "./Trans";
import { jotaiScope } from "../jotai";
import type { LibraryItem, LibraryItems, UIAppState } from "../types";
import { useApp, useExcalidrawSetAppState } from "./App";
import { saveLibraryAsJSON } from "../data/json";
import type Library from "../data/library";
import { libraryItemsAtom } from "../data/library";
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
import { useAtom } from "jotai";
import ConfirmDialog from "./ConfirmDialog";
import PublishLibrary from "./PublishLibrary";
import { Dialog } from "./Dialog";
import DropdownMenu from "./dropdownMenu/DropdownMenu";
import { isLibraryMenuOpenAtom } from "./LibraryMenu";
import { useUIAppState } from "../context/ui-appState";
import clsx from "clsx";
import { useLibraryCache } from "../hooks/useLibraryItemSvg";

const getSelectedItems = (
  libraryItems: LibraryItems,
  selectedItems: LibraryItem["id"][],
) => libraryItems.filter((item) => selectedItems.includes(item.id));

export const LibraryDropdownMenuButton: React.FC<{
  setAppState: React.Component<any, UIAppState>["setState"];
  selectedItems: LibraryItem["id"][];
  library: Library;
  onRemoveFromLibrary: () => void;
  resetLibrary: () => void;
  onSelectItems: (items: LibraryItem["id"][]) => void;
  appState: UIAppState;
  className?: string;
}> = ({
  setAppState,
  selectedItems,
  library,
  onRemoveFromLibrary,
  resetLibrary,
  onSelectItems,
  appState,
  className,
}) => {
  const [libraryItemsData] = useAtom(libraryItemsAtom, jotaiScope);
  const [isLibraryMenuOpen, setIsLibraryMenuOpen] = useAtom(
    isLibraryMenuOpenAtom,
    jotaiScope,
  );

  const renderRemoveLibAlert = () => {
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
  };

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
        size="small"
      >
        <p>
          <Trans
            i18nKey="publishSuccessDialog.content"
            authorName={publishLibSuccess!.authorName}
            link={(el) => (
              <a
                href={publishLibSuccess?.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {el}
              </a>
            )}
          />
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

  const onPublishLibSuccess = (
    data: { url: string; authorName: string },
    libraryItems: LibraryItems,
  ) => {
    setShowPublishLibraryDialog(false);
    setPublishLibSuccess({ url: data.url, authorName: data.authorName });
    const nextLibItems = libraryItems.slice();
    nextLibItems.forEach((libItem) => {
      if (selectedItems.includes(libItem.id)) {
        libItem.status = "published";
      }
    });
    library.setLibrary(nextLibItems);
  };

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
      <DropdownMenu open={isLibraryMenuOpen}>
        <DropdownMenu.Trigger
          onToggle={() => setIsLibraryMenuOpen(!isLibraryMenuOpen)}
        >
          {DotsIcon}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          onClickOutside={() => setIsLibraryMenuOpen(false)}
          onSelect={() => setIsLibraryMenuOpen(false)}
          className="library-menu"
        >
          {!itemsSelected && (
            <DropdownMenu.Item
              onSelect={onLibraryImport}
              icon={LoadIcon}
              data-testid="lib-dropdown--load"
            >
              {t("buttons.load")}
            </DropdownMenu.Item>
          )}
          {!!items.length && (
            <DropdownMenu.Item
              onSelect={onLibraryExport}
              icon={ExportIcon}
              data-testid="lib-dropdown--export"
            >
              {t("buttons.export")}
            </DropdownMenu.Item>
          )}
          {!!items.length && (
            <DropdownMenu.Item
              onSelect={() => setShowRemoveLibAlert(true)}
              icon={TrashIcon}
            >
              {resetLabel}
            </DropdownMenu.Item>
          )}
          {itemsSelected && (
            <DropdownMenu.Item
              icon={publishIcon}
              onSelect={() => setShowPublishLibraryDialog(true)}
              data-testid="lib-dropdown--remove"
            >
              {t("buttons.publishLibrary")}
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>
    );
  };

  return (
    <div className={clsx("library-menu-dropdown-container", className)}>
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

export const LibraryDropdownMenu = ({
  selectedItems,
  onSelectItems,
  className,
}: {
  selectedItems: LibraryItem["id"][];
  onSelectItems: (id: LibraryItem["id"][]) => void;
  className?: string;
}) => {
  const { library } = useApp();
  const { clearLibraryCache, deleteItemsFromLibraryCache } = useLibraryCache();
  const appState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();

  const [libraryItemsData] = useAtom(libraryItemsAtom, jotaiScope);

  const removeFromLibrary = async (libraryItems: LibraryItems) => {
    const nextItems = libraryItems.filter(
      (item) => !selectedItems.includes(item.id),
    );
    library.setLibrary(nextItems).catch(() => {
      setAppState({ errorMessage: t("alerts.errorRemovingFromLibrary") });
    });

    deleteItemsFromLibraryCache(selectedItems);

    onSelectItems([]);
  };

  const resetLibrary = () => {
    library.resetLibrary();
    clearLibraryCache();
  };

  return (
    <LibraryDropdownMenuButton
      appState={appState}
      setAppState={setAppState}
      selectedItems={selectedItems}
      onSelectItems={onSelectItems}
      library={library}
      onRemoveFromLibrary={() =>
        removeFromLibrary(libraryItemsData.libraryItems)
      }
      resetLibrary={resetLibrary}
      className={className}
    />
  );
};
