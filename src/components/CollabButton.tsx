import { t } from "../i18n";
import { UsersIcon } from "./icons";

import "./CollabButton.scss";
import MenuItem from "./menu/MenuItem";
import clsx from "clsx";

const CollabButton = ({
  isCollaborating,
  collaboratorCount,
  onClick,
  isInHamburgerMenu = true,
}: {
  isCollaborating: boolean;
  collaboratorCount: number;
  onClick: () => void;
  isInHamburgerMenu?: boolean;
}) => {
  return (
    <>
      {isInHamburgerMenu ? (
        <MenuItem dataTestId="collab-button" icon={UsersIcon} onClick={onClick}>
          {t("labels.liveCollaboration")}
        </MenuItem>
      ) : (
        <button
          className={clsx("collab-button", { active: isCollaborating })}
          type="button"
          onClick={onClick}
          style={{ position: "relative" }}
          title={t("labels.liveCollaboration")}
        >
          {UsersIcon}
          {collaboratorCount > 0 && (
            <div className="CollabButton-collaborators">
              {collaboratorCount}
            </div>
          )}
        </button>
      )}
    </>
  );
};

export default CollabButton;
