import clsx from "clsx";

import { isMobileOrTablet, MQ_MIN_WIDTH_DESKTOP } from "@excalidraw/common";

import { t } from "../../i18n";
import { Button } from "../Button";
import { share } from "../icons";
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

  const showIconOnly =
    isMobileOrTablet() || appState.width < MQ_MIN_WIDTH_DESKTOP;

  return (
    <Button
      {...rest}
      className={clsx("collab-button", { active: isCollaborating })}
      type="button"
      onSelect={onSelect}
      style={{ position: "relative", width: showIconOnly ? undefined : "auto" }}
      title={t("labels.liveCollaboration")}
    >
      {showIconOnly ? share : t("labels.share")}
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
