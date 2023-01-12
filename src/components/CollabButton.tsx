import { t } from "../i18n";
import { UsersIcon } from "./icons";

import "./CollabButton.scss";
import clsx from "clsx";
import { Button } from "./Button";

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
    <Button
      className={clsx("collab-button", { active: isCollaborating })}
      type="button"
      onSelect={onClick}
      style={{ position: "relative" }}
      title={t("labels.liveCollaboration")}
    >
      {UsersIcon}
      {collaboratorCount > 0 && (
        <div className="CollabButton-collaborators">{collaboratorCount}</div>
      )}
    </Button>
  );
};

export default CollabButton;
