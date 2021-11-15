import { ReactNode, useState } from "react";
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

const PublishLibrary = ({
  onClose,
  libraryItems,
  appState,
  onSuccess,
  onError,
}: {
  onClose: () => void;
  libraryItems: LibraryItems;
  appState: AppState;
  onSuccess: (data: { url: string; authorName: string }) => void;
  onError: (error: Error) => void;
}) => {
  const [libraryData, setLibraryData] = useState({
    authorName: "",
    githubHandle: "",
    name: "",
    description: "",
    twitterHandle: "",
    website: "",
  });

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

    const erroredLibItems: LibraryItem[] = [];
    let isError = false;
    clonedLibItems.forEach((libItem) => {
      let error = "";
      if (!libItem.name) {
        error = "Required";
        isError = true;
      } else if (!/^[a-zA-Z\s]+$/i.test(libItem.name)) {
        error = "Only letters and spaces allowed";
        isError = true;
      }
      erroredLibItems.push({ ...libItem, error });
    });

    if (isError) {
      setClonedLibItems(erroredLibItems);
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
            response.json().then(({ url }) => {
              onSuccess({
                url,
                authorName: libraryData.authorName,
              });
            });
          } else {
            return response
              .json()
              .catch(() => {
                throw new Error(response.statusText || "something went wrong");
              })
              .then((error) => {
                throw new Error(
                  error.message ||
                    response.statusText ||
                    "something went wrong",
                );
              });
          }
        },
        (err) => {
          console.error(err);
          onError(err);
        },
      )
      .catch((err) => {
        console.error(err);
        onError(err);
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
  return (
    <Dialog
      onCloseRequest={onClose}
      title="Publish Library"
      className="publish-library"
      closeOnClickOutside={false}
    >
      <form onSubmit={onSubmit}>
        {renderLibraryItems()}

        <div className="publish-library__fields">
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
              placeholder={t("publishSuccessDialog.placeholder.authorName")}
            />
          </label>
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
              placeholder={t("publishSuccessDialog.placeholder.libraryName")}
            />
          </label>
          <label>
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
              placeholder={t("publishSuccessDialog.placeholder.libraryDesc")}
            />
          </label>
          <label>
            <span>{t("publishDialog.githubUsername")}</span>
            <input
              type="text"
              name="githubHandle"
              value={libraryData.githubHandle}
              onChange={onInputChange}
              placeholder={t("publishSuccessDialog.placeholder.githubHandle")}
            />
          </label>
          <label>
            <span>{t("publishDialog.twitterUsername")}</span>
            <input
              type="text"
              name="twitterHandle"
              value={libraryData.twitterHandle}
              onChange={onInputChange}
              placeholder={t("publishSuccessDialog.placeholder.twitterHandle")}
            />
          </label>
          <label>
            <span>{t("publishDialog.website")}</span>
            <input
              type="text"
              name="website"
              value={libraryData.website}
              onChange={onInputChange}
              placeholder={t("publishSuccessDialog.placeholder.website")}
            />
          </label>
        </div>
        <div className="publish-library__buttons">
          <ToolButton
            type="button"
            title={t("buttons.cancel")}
            aria-label={t("buttons.cancel")}
            label={t("buttons.cancel")}
            onClick={onClose}
            data-testid="cancel-clear-canvas-button"
            className="publish-library__buttons--cancel"
          />
          <ToolButton
            type="submit"
            title={t("buttons.submit")}
            aria-label={t("buttons.submit")}
            label={t("buttons.submit")}
            className="publish-library__buttons--confirm"
          />
        </div>
      </form>
    </Dialog>
  );
};

export default PublishLibrary;
