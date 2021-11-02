import { Dialog } from "./Dialog";
import { t } from "../i18n";

import { ToolButton } from "./ToolButton";

import { useState } from "react";
import { AppState, LibraryItems } from "../types";
import { exportToBlob } from "../packages/utils";
import { EXPORT_DATA_TYPES, EXPORT_SOURCE } from "../constants";
import { ExportedLibraryData } from "../data/types";

import "./PublishLibrary.scss";
import { ExcalidrawElement } from "../element/types";

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
  });

  const onInputChange = (event: any) => {
    setLibraryData({
      ...libraryData,
      [event.target.name]: event.target.value,
    });
  };

  const onSubmit = async () => {
    const elements: ExcalidrawElement[] = [];
    libraryItems.forEach((libItem) => {
      elements.push(...libItem.items);
    });
    const png = await exportToBlob({
      elements,
      mimeType: "image/png",
      appState,
      files: null,
    });

    const libContent: ExportedLibraryData = {
      type: EXPORT_DATA_TYPES.excalidrawLibrary,
      version: 1,
      source: EXPORT_SOURCE,
      library: libraryItems,
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

    fetch(
      "https://us-central1-excalidraw-room-persistence.cloudfunctions.net/api/libraries/publish",
      {
        method: "post",
        body: formData,
      },
    )
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
            throw new Error(response.statusText || "something went wrong");
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
  return (
    <Dialog
      onCloseRequest={onClose}
      title="Publish Library"
      className="publish-library"
    >
      <form>
        <div className="publish-library__fields">
          <label>
            <span>Author Name:</span>
            <input
              type="text"
              name="authorName"
              required
              value={libraryData.authorName}
              onChange={onInputChange}
            />
          </label>
          <label>
            <span>Github Handle:</span>
            <input
              type="text"
              name="githubHandle"
              required
              value={libraryData.githubHandle}
              onChange={onInputChange}
            />
          </label>
          <label>
            <span>Library Name:</span>
            <input
              type="text"
              name="name"
              required
              value={libraryData.name}
              onChange={onInputChange}
            />
          </label>
          <label>
            <span>Library Descripton:</span>
            <textarea
              name="description"
              rows={4}
              required
              value={libraryData.description}
              onChange={onInputChange}
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
            type="button"
            title={t("buttons.submit")}
            aria-label={t("buttons.submit")}
            label={t("buttons.submit")}
            onClick={onSubmit}
            className="publish-library__buttons--confirm"
          />
        </div>
      </form>
    </Dialog>
  );
};

export default PublishLibrary;
