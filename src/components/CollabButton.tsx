import { t } from "../i18n";
import { UsersIcon } from "./icons";

import "./CollabButton.scss";
import clsx from "clsx";

const CollabButton = ({
  isCollaborating,
  collaboratorCount,
  onClick,
}: {
  isCollaborating: boolean;
  collaboratorCount: number;
  onClick: () => void;
}) => {
  return (
    <button
      className={clsx("collab-button", { active: isCollaborating })}
      type="button"
      onClick={onClick}
      style={{ position: "relative" }}
      title={t("labels.liveCollaboration")}
    >
      {UsersIcon}
      {collaboratorCount > 0 && (
        <div className="CollabButton-collaborators">{collaboratorCount}</div>
      )}
    </button>
  );
};

export default CollabButton;
