import { t } from "../../i18n";
import { UsersIcon } from "../icons";

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
    <button
      className={clsx("collab-button", { active: isCollaborating })}
      type="button"
      onClick={onSelect}
      style={{ position: "relative" }}
      title={t("labels.liveCollaboration")}
    >
      {UsersIcon}
      {appState.collaborators.size > 0 && (
        <div className="CollabButton-collaborators">
          {appState.collaborators.size}
        </div>
      )}
    </button>
  );
};

export default LiveCollaboration;
LiveCollaboration.displayName = "LiveCollaboration";
