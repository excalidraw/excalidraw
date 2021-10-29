import { Dialog } from "./Dialog";
import { t } from "../i18n";

import { ToolButton } from "./ToolButton";

import "./PublishLibrary.scss";
import { useState } from "react";
const PublishLibrary = ({ onClose }: { onClose: () => void }) => {
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
            onClick={() => {}}
            className="publish-library__buttons--confirm"
          />
        </div>
      </form>
    </Dialog>
  );
};

export default PublishLibrary;
