import clsx from "clsx";
import { useCallback, useState } from "react";

import { muteFSAbortError } from "@excalidraw/common";

import { useUIAppState } from "../context/ui-appState";
import { fileOpen } from "../data/filesystem";
import { saveLibraryAsJSON } from "../data/json";
import { libraryItemsAtom } from "../data/library";
import { useAtom } from "../editor-jotai";
import { useLibraryCache } from "../hooks/useLibraryItemSvg";
import { t } from "../i18n";

import { useApp, useExcalidrawSetAppState } from "./App";
import ConfirmDialog from "./ConfirmDialog";
import { Dialog } from "./Dialog";
import { isLibraryMenuOpenAtom } from "./LibraryMenu";
import PublishLibrary from "./PublishLibrary";
import { ToolButton } from "./ToolButton";
import Trans from "./Trans";
import DropdownMenu from "./dropdownMenu/DropdownMenu";
import {
  ArrowRightIcon,
  DotsIcon,
  ExportIcon,
  LoadIcon,
  pencilIcon,
  PlusIcon,
  publishIcon,
  TrashIcon,
} from "./icons";

import type Library from "../data/library";
import type { LibraryItem, LibraryItems, UIAppState } from "../types";

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
  const [libraryItemsData] = useAtom(libraryItemsAtom);
  const [isLibraryMenuOpen, setIsLibraryMenuOpen] = useAtom(
    isLibraryMenuOpenAtom,
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
          <DropdownMenu.Item
            onSelect={async () => {
              // prompt for a collection name and create a new library collection
              const name = window.prompt("Create library");
              if (!name) {
                return;
              }
              try {
                await library.createLibraryCollection(name);
              } catch (error: any) {
                setAppState({ errorMessage: error?.message || String(error) });
              }
            }}
            icon={PlusIcon}
            data-testid="lib-dropdown--create"
          >
            {"Create library"}
          </DropdownMenu.Item>
          {!!items.length && (
            <DropdownMenu.Item
              onSelect={onLibraryExport}
              icon={ExportIcon}
              data-testid="lib-dropdown--export"
            >
              {t("buttons.export")}
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
          {!!items.length && (
            <DropdownMenu.Item
              onSelect={() => setShowRemoveLibAlert(true)}
              icon={TrashIcon}
            >
              {resetLabel}
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

export const CollectionHeaderDropdown: React.FC<{
  collectionName: string;
  onRename: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}> = ({
  collectionName,
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={clsx("library-menu-dropdown-container", {
        "collection-dropdown-open": isOpen,
      })}
      onClick={(e) => {
        e.stopPropagation();
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
    >
      <DropdownMenu open={isOpen}>
        <DropdownMenu.Trigger
          onToggle={() => setIsOpen(!isOpen)}
          className="collection-header-dropdown-trigger"
        >
          {DotsIcon}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          onClickOutside={() => setIsOpen(false)}
          onSelect={() => setIsOpen(false)}
          className="collection-header-menu"
        >
          <DropdownMenu.Item
            onSelect={onRename}
            icon={pencilIcon}
            data-testid="collection-dropdown--rename"
          >
            Rename
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={onDelete}
            icon={TrashIcon}
            data-testid="collection-dropdown--delete"
          >
            {t("labels.delete")}
          </DropdownMenu.Item>
          {onMoveUp && canMoveUp && (
            <DropdownMenu.Item
              onSelect={onMoveUp}
              icon={
                <div style={{ transform: "rotate(-90deg)" }}>
                  {ArrowRightIcon}
                </div>
              }
              data-testid="collection-dropdown--move-up"
            >
              Move Up
            </DropdownMenu.Item>
          )}
          {onMoveDown && canMoveDown && (
            <DropdownMenu.Item
              onSelect={onMoveDown}
              icon={
                <div style={{ transform: "rotate(90deg)" }}>
                  {ArrowRightIcon}
                </div>
              }
              data-testid="collection-dropdown--move-down"
            >
              Move Down
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>
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

  const [libraryItemsData] = useAtom(libraryItemsAtom);

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
