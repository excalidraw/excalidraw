import { t } from "../../i18n";
import { usersIcon } from "../icons";
import { Button } from "../Button";

import clsx from "clsx";
import { useExcalidrawAppState } from "../App";

import "./LiveCollaboration.scss";

const LiveCollaboration = ({
  isCollaborating,
  onSelect,
}: {
  isCollaborating: boolean;
  onSelect: () => void;
}) => {
  const appState = useExcalidrawAppState();

  return (
    <Button
      className={clsx("collab-button", { active: isCollaborating })}
      type="button"
      onSelect={onSelect}
      style={{ position: "relative" }}
      title={t("labels.liveCollaboration")}
    >
      {usersIcon}
      {appState.collaborators.size > 0 && (
        <div className="CollabButton-collaborators">
          {appState.collaborators.size}
        </div>
      )}
    </Button>
  );
};

export default LiveCollaboration;
LiveCollaboration.displayName = "LiveCollaboration";
