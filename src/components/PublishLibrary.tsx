import { ReactNode, useCallback, useEffect, useState } from "react";
import oc from "open-color";

import { Dialog } from "./Dialog";
import { t } from "../i18n";

import { ToolButton } from "./ToolButton";

import { AppState, LibraryItems, LibraryItem } from "../types";
import { exportToBlob } from "../packages/utils";
import { EXPORT_DATA_TYPES, EXPORT_SOURCE } from "../constants";
import { ExportedLibraryData } from "../data/types";

import "./PublishLibrary.scss";
import { ExcalidrawElement } from "../element/types";
import { newElement } from "../element";
import { mutateElement } from "../element/mutateElement";
import { getCommonBoundingBox } from "../element/bounds";
import SingleLibraryItem from "./SingleLibraryItem";
import {
  savePublishLibDataToStorage,
  importPublishLibDataFromStorage,
  clearPublishLibDataInStorage,
} from "../excalidraw-app/data/localStorage";

export interface PublishLibraryDataParams {
  authorName: string;
  githubHandle: string;
  name: string;
  description: string;
  twitterHandle: string;
  website: string;
}
const PublishLibrary = ({
  onClose,
  libraryItems,
  appState,
  onSuccess,
  onError,
  updateItemsInStorage,
}: {
  onClose: () => void;
  libraryItems: LibraryItems;
  appState: AppState;
  onSuccess: (data: {
    url: string;
    authorName: string;
    items: LibraryItems;
  }) => void;

  onError: (error: Error) => void;
  updateItemsInStorage: (items: LibraryItems) => void;
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
    const data = importPublishLibDataFromStorage();
    if (data) {
      setLibraryData(data);
    }
  }, []);

  const [clonedLibItems, setClonedLibItems] = useState<LibraryItems>(
    libraryItems.slice(),
  );

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
      } else if (!/^[a-zA-Z\s]+$/i.test(libItem.name)) {
        error = t("publishDialog.errors.letter&Spaces");
        isError = true;
      }
      erroredLibItems.push({ ...libItem, error });
    });

    if (isError) {
      setClonedLibItems(erroredLibItems);
      setIsSubmitting(false);
      return;
    }
    const elements: ExcalidrawElement[] = [];
    const prevBoundingBox = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    clonedLibItems.forEach((libItem) => {
      const boundingBox = getCommonBoundingBox(libItem.elements);
      const width = boundingBox.maxX - boundingBox.minX + 30;
      const height = boundingBox.maxY - boundingBox.minY + 30;
      const offset = {
        x: prevBoundingBox.maxX - boundingBox.minX,
        y: prevBoundingBox.maxY - boundingBox.minY,
      };

      const itemsWithUpdatedCoords = libItem.elements.map((element) => {
        element = mutateElement(element, {
          x: element.x + offset.x + 15,
          y: element.y + offset.y + 15,
        });
        return element;
      });
      const items = [
        ...itemsWithUpdatedCoords,
        newElement({
          type: "rectangle",
          width,
          height,
          x: prevBoundingBox.maxX,
          y: prevBoundingBox.maxY,
          strokeColor: "#ced4da",
          backgroundColor: "transparent",
          strokeStyle: "solid",
          opacity: 100,
          roughness: 0,
          strokeSharpness: "sharp",
          fillStyle: "solid",
          strokeWidth: 1,
        }),
      ];
      elements.push(...items);
      prevBoundingBox.maxX = prevBoundingBox.maxX + width + 30;
    });
    const png = await exportToBlob({
      elements,
      mimeType: "image/png",
      appState: {
        ...appState,
        viewBackgroundColor: oc.white,
        exportBackground: true,
      },
      files: null,
    });

    const libContent: ExportedLibraryData = {
      type: EXPORT_DATA_TYPES.excalidrawLibrary,
      version: 2,
      source: EXPORT_SOURCE,
      libraryItems: clonedLibItems,
    };
    const content = JSON.stringify(libContent, null, 2);
    const lib = new Blob([content], { type: "application/json" });

    const formData = new FormData();
    formData.append("excalidrawLib", lib);
    formData.append("excalidrawPng", png!);
    formData.append("title", libraryData.name);
    formData.append("authorName", libraryData.authorName);
    formData.append("githubHandle", libraryData.githubHandle);
    formData.append("name", libraryData.name);
    formData.append("description", libraryData.description);
    formData.append("twitterHandle", libraryData.twitterHandle);
    formData.append("website", libraryData.website);

    fetch(`${process.env.REACT_APP_LIBRARY_BACKEND}/api/libraries/publish`, {
      method: "post",
      body: formData,
    })
      .then(
        (response) => {
          if (response.ok) {
            return response.json().then(({ url }) => {
              clearPublishLibDataInStorage();
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
          />
        </div>,
      );
    });
    return <div className="selected-library-items">{items}</div>;
  };

  const onDialogClose = useCallback(() => {
    updateItemsInStorage(clonedLibItems);
    savePublishLibDataToStorage(libraryData);
    onClose();
  }, [clonedLibItems, onClose, updateItemsInStorage, libraryData]);
  return (
    <Dialog
      onCloseRequest={onDialogClose}
      title={t("publishDialog.title")}
      className="publish-library"
    >
      <form onSubmit={onSubmit}>
        <div className="publish-library-note">
          {t("publishDialog.noteDescription.pre")}
          <a
            href="https://libraries.excalidraw.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("publishDialog.noteDescription.link")}
          </a>{" "}
          {t("publishDialog.noteDescription.post")}
        </div>
        <span className="publish-library-note">
          {t("publishDialog.noteGuidelines.pre")}
          <a
            href="https://github.com/excalidraw/excalidraw-libraries#guidelines"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("publishDialog.noteGuidelines.link")}
          </a>
          {t("publishDialog.noteGuidelines.post")}
        </span>

        <div className="publish-library-note">
          {t("publishDialog.noteItems")}
        </div>
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
              value={libraryData.website}
              onChange={onInputChange}
              placeholder={t("publishDialog.placeholder.website")}
            />
          </label>
          <span className="publish-library-note">
            {t("publishDialog.noteLicense.pre")}
            <a
              href="https://github.com/excalidraw/excalidraw-libraries/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("publishDialog.noteLicense.link")}
            </a>
            {t("publishDialog.noteLicense.post")}
          </span>
        </div>
        <div className="publish-library__buttons">
          <ToolButton
            type="button"
            title={t("buttons.cancel")}
            aria-label={t("buttons.cancel")}
            label={t("buttons.cancel")}
            onClick={onDialogClose}
            data-testid="cancel-clear-canvas-button"
            className="publish-library__buttons--cancel"
          />
          <ToolButton
            type="submit"
            title={t("buttons.submit")}
            aria-label={t("buttons.submit")}
            label={t("buttons.submit")}
            className="publish-library__buttons--confirm"
            isLoading={isSubmitting}
          />
        </div>
      </form>
    </Dialog>
  );
};

export default PublishLibrary;
