import { t } from "../i18n";
import { users } from "./icons";

import "./CollabButton.scss";
import MenuItem from "./MenuItem";

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
    <>
      <MenuItem
        label={t("labels.liveCollaboration")}
        dataTestId="collab-button"
        icon={users}
        onClick={onClick}
      />
      {/* // TODO barnabasmolnar/editor-redesign  */}
      {/* do we want to show the collaborator count here? */}
      {/* {isCollaborating && (
        <div className="CollabButton-collaborators">{collaboratorCount}</div>
      )} */}
    </>
  );
};

export default CollabButton;
