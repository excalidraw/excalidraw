import { exportToCanvas, exportToSvg } from "@excalidraw/utils/export";
import OpenColor from "open-color";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  EDITOR_LS_KEYS,
  EXPORT_DATA_TYPES,
  MIME_TYPES,
  VERSIONS,
  chunk,
  getExportSource,
} from "@excalidraw/common";

import { EditorLocalStorage } from "../data/EditorLocalStorage";
import { canvasToBlob, resizeImageFile } from "../data/blob";
import { t } from "../i18n";

import { Dialog } from "./Dialog";
import DialogActionButton from "./DialogActionButton";
import { ToolButton } from "./ToolButton";
import Trans from "./Trans";
import { CloseIcon } from "./icons";

import "./PublishLibrary.scss";

import type { ReactNode } from "react";
import type { ExportedLibraryData } from "../data/types";
import type { LibraryItems, LibraryItem, UIAppState } from "../types";

interface PublishLibraryDataParams {
  authorName: string;
  githubHandle: string;
  name: string;
  description: string;
  twitterHandle: string;
  website: string;
}

const generatePreviewImage = async (libraryItems: LibraryItems) => {
  const MAX_ITEMS_PER_ROW = 6;
  const BOX_SIZE = 128;
  const BOX_PADDING = Math.round(BOX_SIZE / 16);
  const BORDER_WIDTH = Math.max(Math.round(BOX_SIZE / 64), 2);

  const rows = chunk(libraryItems, MAX_ITEMS_PER_ROW);

  const canvas = document.createElement("canvas");

  canvas.width =
    rows[0].length * BOX_SIZE +
    (rows[0].length + 1) * (BOX_PADDING * 2) -
    BOX_PADDING * 2;
  canvas.height =
    rows.length * BOX_SIZE +
    (rows.length + 1) * (BOX_PADDING * 2) -
    BOX_PADDING * 2;

  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = OpenColor.white;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // draw items
  // ---------------------------------------------------------------------------
  for (const [index, item] of libraryItems.entries()) {
    const itemCanvas = await exportToCanvas({
      elements: item.elements,
      files: null,
      maxWidthOrHeight: BOX_SIZE,
    });

    const { width, height } = itemCanvas;

    // draw item
    // -------------------------------------------------------------------------
    const rowOffset =
      Math.floor(index / MAX_ITEMS_PER_ROW) * (BOX_SIZE + BOX_PADDING * 2);
    const colOffset =
      (index % MAX_ITEMS_PER_ROW) * (BOX_SIZE + BOX_PADDING * 2);

    ctx.drawImage(
      itemCanvas,
      colOffset + (BOX_SIZE - width) / 2 + BOX_PADDING,
      rowOffset + (BOX_SIZE - height) / 2 + BOX_PADDING,
    );

    // draw item border
    // -------------------------------------------------------------------------
    ctx.lineWidth = BORDER_WIDTH;
    ctx.strokeStyle = OpenColor.gray[4];
    ctx.strokeRect(
      colOffset + BOX_PADDING / 2,
      rowOffset + BOX_PADDING / 2,
      BOX_SIZE + BOX_PADDING,
      BOX_SIZE + BOX_PADDING,
    );
  }

  return await resizeImageFile(
    new File([await canvasToBlob(canvas)], "preview", { type: MIME_TYPES.png }),
    {
      outputType: MIME_TYPES.jpg,
      maxWidthOrHeight: 5000,
    },
  );
};

const SingleLibraryItem = ({
  libItem,
  appState,
  index,
  onChange,
  onRemove,
}: {
  libItem: LibraryItem;
  appState: UIAppState;
  index: number;
  onChange: (val: string, index: number) => void;
  onRemove: (id: string) => void;
}) => {
  const svgRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const node = svgRef.current;
    if (!node) {
      return;
    }
    (async () => {
      const svg = await exportToSvg({
        elements: libItem.elements,
        appState: {
          ...appState,
          viewBackgroundColor: OpenColor.white,
          exportBackground: true,
        },
        files: null,
        skipInliningFonts: true,
      });
      node.innerHTML = svg.outerHTML;
    })();
  }, [libItem.elements, appState]);

  return (
    <div className="single-library-item">
      {libItem.status === "published" && (
        <span className="single-library-item-status">
          {t("labels.statusPublished")}
        </span>
      )}
      <div ref={svgRef} className="single-library-item__svg" />
      <ToolButton
        aria-label={t("buttons.remove")}
        type="button"
        icon={CloseIcon}
        className="single-library-item--remove"
        onClick={onRemove.bind(null, libItem.id)}
        title={t("buttons.remove")}
      />
      <div
        style={{
          display: "flex",
          margin: "0.8rem 0",
          width: "100%",
          fontSize: "14px",
          fontWeight: 500,
          flexDirection: "column",
        }}
      >
        <label
          style={{
            display: "flex",
            justifyContent: "space-between",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: "0.5em 0" }}>
            <span style={{ fontWeight: 500, color: OpenColor.gray[6] }}>
              {t("publishDialog.itemName")}
            </span>
            <span aria-hidden="true" className="required">
              *
            </span>
          </div>
          <input
            type="text"
            ref={inputRef}
            style={{ width: "80%", padding: "0.2rem" }}
            defaultValue={libItem.name}
            placeholder="Item name"
            onChange={(event) => {
              onChange(event.target.value, index);
            }}
          />
        </label>
        <span className="error">{libItem.error}</span>
      </div>
    </div>
  );
};

const PublishLibrary = ({
  onClose,
  libraryItems,
  appState,
  onSuccess,
  onError,
  updateItemsInStorage,
  onRemove,
}: {
  onClose: () => void;
  libraryItems: LibraryItems;
  appState: UIAppState;
  onSuccess: (data: {
    url: string;
    authorName: string;
    items: LibraryItems;
  }) => void;

  onError: (error: Error) => void;
  updateItemsInStorage: (items: LibraryItems) => void;
  onRemove: (id: string) => void;
}) => {
  const [libraryData, setLibraryData] = useState<PublishLibraryDataParams>({
    authorName: "",
    githubHandle: "",
    name: "",
    description: "",
    twitterHandle: "",
    website: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const data = EditorLocalStorage.get<PublishLibraryDataParams>(
      EDITOR_LS_KEYS.PUBLISH_LIBRARY,
    );
    if (data) {
      setLibraryData(data);
    }
  }, []);

  const [clonedLibItems, setClonedLibItems] = useState<LibraryItems>(
    libraryItems.slice(),
  );

  useEffect(() => {
    setClonedLibItems(libraryItems.slice());
  }, [libraryItems]);

  const onInputChange = (event: any) => {
    setLibraryData({
      ...libraryData,
      [event.target.name]: event.target.value,
    });
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const erroredLibItems: LibraryItem[] = [];
    let isError = false;
    clonedLibItems.forEach((libItem) => {
      let error = "";
      if (!libItem.name) {
        error = t("publishDialog.errors.required");
        isError = true;
      }
      erroredLibItems.push({ ...libItem, error });
    });

    if (isError) {
      setClonedLibItems(erroredLibItems);
      setIsSubmitting(false);
      return;
    }

    const previewImage = await generatePreviewImage(clonedLibItems);

    const libContent: ExportedLibraryData = {
      type: EXPORT_DATA_TYPES.excalidrawLibrary,
      version: VERSIONS.excalidrawLibrary,
      source: getExportSource(),
      libraryItems: clonedLibItems,
    };
    const content = JSON.stringify(libContent, null, 2);
    const lib = new Blob([content], { type: "application/json" });

    const formData = new FormData();
    formData.append("excalidrawLib", lib);
    formData.append("previewImage", previewImage);
    formData.append("previewImageType", previewImage.type);
    formData.append("title", libraryData.name);
    formData.append("authorName", libraryData.authorName);
    formData.append("githubHandle", libraryData.githubHandle);
    formData.append("name", libraryData.name);
    formData.append("description", libraryData.description);
    formData.append("twitterHandle", libraryData.twitterHandle);
    formData.append("website", libraryData.website);

    fetch(`${import.meta.env.VITE_APP_LIBRARY_BACKEND}/submit`, {
      method: "post",
      body: formData,
    })
      .then(
        (response) => {
          if (response.ok) {
            return response.json().then(({ url }) => {
              // flush data from local storage
              EditorLocalStorage.delete(EDITOR_LS_KEYS.PUBLISH_LIBRARY);
              onSuccess({
                url,
                authorName: libraryData.authorName,
                items: clonedLibItems,
              });
            });
          }
          return response
            .json()
            .catch(() => {
              throw new Error(response.statusText || "something went wrong");
            })
            .then((error) => {
              throw new Error(
                error.message || response.statusText || "something went wrong",
              );
            });
        },
        (err) => {
          console.error(err);
          onError(err);
          setIsSubmitting(false);
        },
      )
      .catch((err) => {
        console.error(err);
        onError(err);
        setIsSubmitting(false);
      });
  };

  const renderLibraryItems = () => {
    const items: ReactNode[] = [];
    clonedLibItems.forEach((libItem, index) => {
      items.push(
        <div className="single-library-item-wrapper" key={index}>
          <SingleLibraryItem
            libItem={libItem}
            appState={appState}
            index={index}
            onChange={(val, index) => {
              const items = clonedLibItems.slice();
              items[index].name = val;
              setClonedLibItems(items);
            }}
            onRemove={onRemove}
          />
        </div>,
      );
    });
    return <div className="selected-library-items">{items}</div>;
  };

  const onDialogClose = useCallback(() => {
    updateItemsInStorage(clonedLibItems);
    EditorLocalStorage.set(EDITOR_LS_KEYS.PUBLISH_LIBRARY, libraryData);
    onClose();
  }, [clonedLibItems, onClose, updateItemsInStorage, libraryData]);

  const shouldRenderForm = !!libraryItems.length;

  const containsPublishedItems = libraryItems.some(
    (item) => item.status === "published",
  );

  return (
    <Dialog
      onCloseRequest={onDialogClose}
      title={t("publishDialog.title")}
      className="publish-library"
    >
      {shouldRenderForm ? (
        <form onSubmit={onSubmit}>
          <div className="publish-library-note">
            <Trans
              i18nKey="publishDialog.noteDescription"
              link={(el) => (
                <a
                  href="https://libraries.excalidraw.com"
                  target="_blank"
                  rel="noopener"
                >
                  {el}
                </a>
              )}
            />
          </div>
          <span className="publish-library-note">
            <Trans
              i18nKey="publishDialog.noteGuidelines"
              link={(el) => (
                <a
                  href="https://github.com/excalidraw/excalidraw-libraries#guidelines"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {el}
                </a>
              )}
            />
          </span>

          <div className="publish-library-note">
            {t("publishDialog.noteItems")}
          </div>
          {containsPublishedItems && (
            <span className="publish-library-note publish-library-warning">
              {t("publishDialog.republishWarning")}
            </span>
          )}
          {renderLibraryItems()}
          <div className="publish-library__fields">
            <label>
              <div>
                <span>{t("publishDialog.libraryName")}</span>
                <span aria-hidden="true" className="required">
                  *
                </span>
              </div>
              <input
                type="text"
                name="name"
                required
                value={libraryData.name}
                onChange={onInputChange}
                placeholder={t("publishDialog.placeholder.libraryName")}
              />
            </label>
            <label style={{ alignItems: "flex-start" }}>
              <div>
                <span>{t("publishDialog.libraryDesc")}</span>
                <span aria-hidden="true" className="required">
                  *
                </span>
              </div>
              <textarea
                name="description"
                rows={4}
                required
                value={libraryData.description}
                onChange={onInputChange}
                placeholder={t("publishDialog.placeholder.libraryDesc")}
              />
            </label>
            <label>
              <div>
                <span>{t("publishDialog.authorName")}</span>
                <span aria-hidden="true" className="required">
                  *
                </span>
              </div>
              <input
                type="text"
                name="authorName"
                required
                value={libraryData.authorName}
                onChange={onInputChange}
                placeholder={t("publishDialog.placeholder.authorName")}
              />
            </label>
            <label>
              <span>{t("publishDialog.githubUsername")}</span>
              <input
                type="text"
                name="githubHandle"
                value={libraryData.githubHandle}
                onChange={onInputChange}
                placeholder={t("publishDialog.placeholder.githubHandle")}
              />
            </label>
            <label>
              <span>{t("publishDialog.twitterUsername")}</span>
              <input
                type="text"
                name="twitterHandle"
                value={libraryData.twitterHandle}
                onChange={onInputChange}
                placeholder={t("publishDialog.placeholder.twitterHandle")}
              />
            </label>
            <label>
              <span>{t("publishDialog.website")}</span>
              <input
                type="text"
                name="website"
                pattern="https?://.+"
                title={t("publishDialog.errors.website")}
                value={libraryData.website}
                onChange={onInputChange}
                placeholder={t("publishDialog.placeholder.website")}
              />
            </label>
            <span className="publish-library-note">
              <Trans
                i18nKey="publishDialog.noteLicense"
                link={(el) => (
                  <a
                    href="https://github.com/excalidraw/excalidraw-libraries/blob/main/LICENSE"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {el}
                  </a>
                )}
              />
            </span>
          </div>
          <div className="publish-library__buttons">
            <DialogActionButton
              label={t("buttons.cancel")}
              onClick={onDialogClose}
              data-testid="cancel-clear-canvas-button"
            />
            <DialogActionButton
              type="submit"
              label={t("buttons.submit")}
              actionType="primary"
              isLoading={isSubmitting}
            />
          </div>
        </form>
      ) : (
        <p style={{ padding: "1em", textAlign: "center", fontWeight: 500 }}>
          {t("publishDialog.atleastOneLibItem")}
        </p>
      )}
    </Dialog>
  );
};

export default PublishLibrary;
