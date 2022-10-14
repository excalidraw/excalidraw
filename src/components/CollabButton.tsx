import { t } from "../i18n";
import { share, users } from "./icons";

import "./CollabButton.scss";
import MenuItem from "./MenuItem";

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
        />
      ) : (
        <button className="collab-button" type="button" onClick={onClick}>
          {share}
        </button>
      )}
      {/* // TODO barnabasmolnar/editor-redesign  */}
      {/* do we want to show the collaborator count here? */}
      {/* {isCollaborating && (
        <div className="CollabButton-collaborators">{collaboratorCount}</div>
      )} */}
    </>
  );
};

export default CollabButton;
