import { t } from "../../i18n";
import { Button } from "../Button";
import { usersIcon } from "../icons";

import clsx from "clsx";

import { useUIAppState } from "../../context/ui-appState";
import "./LiveCollaborationTrigger.scss";

const LiveCollaborationTrigger = ({
  isCollaborating,
  onSelect,
  ...rest
}: {
  isCollaborating: boolean;
  onSelect: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const appState = useUIAppState();

  return (
    <Button
      {...rest}
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

export default LiveCollaborationTrigger;
LiveCollaborationTrigger.displayName = "LiveCollaborationTrigger";
