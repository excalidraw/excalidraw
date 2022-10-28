import { t } from "../i18n";
import { share, users } from "./icons";

import "./CollabButton.scss";
import MenuItem from "./MenuItem";
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
        <MenuItem
          label={t("labels.liveCollaboration")}
          dataTestId="collab-button"
          icon={users}
          onClick={onClick}
          isCollaborating={isCollaborating}
        />
      ) : (
        <button
          className={clsx("collab-button", { active: isCollaborating })}
          type="button"
          onClick={onClick}
          style={{ position: "relative" }}
        >
          {share}
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
