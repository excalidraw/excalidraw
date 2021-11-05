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
    twitterHandle: "",
    website: "",
  });

  const onInputChange = (event: any) => {
    setLibraryData({
      ...libraryData,
      [event.target.name]: event.target.value,
    });
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    formData.append("twitterHandle", libraryData.twitterHandle);
    formData.append("website", libraryData.website);

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
      <form onSubmit={onSubmit}>
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
            />
          </label>
          <label>
            <span>{t("publishDialog.githubUsername")}</span>
            <input
              type="text"
              name="githubHandle"
              value={libraryData.githubHandle}
              onChange={onInputChange}
            />
          </label>
          <label>
            <span>{t("publishDialog.twitterUsername")}</span>
            <input
              type="text"
              name="twitterHandle"
              value={libraryData.twitterHandle}
              onChange={onInputChange}
            />
          </label>
          <label>
            <span>{t("publishDialog.website")}</span>
            <input
              type="text"
              name="website"
              value={libraryData.website}
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
