import clsx from "clsx";

import { MQ_MIN_WIDTH_DESKTOP, type EditorInterface } from "@excalidraw/common";

import { t } from "../../i18n";
import { Button } from "../Button";
import { share } from "../icons";
import { useUIAppState } from "../../context/ui-appState";

import "./LiveCollaborationTrigger.scss";

const LiveCollaborationTrigger = ({
  isCollaborating,
  onSelect,
  editorInterface,
  iconOnly,
  ...rest
}: {
  isCollaborating: boolean;
  onSelect: () => void;
  editorInterface?: EditorInterface;
  /**
   * force the icon-only (`true`) or labeled (`false`) variant, e.g. from a
   * `<Region.Item collapse="render">`; by default it's derived from the
   * form factor and editor width
   */
  iconOnly?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const appState = useUIAppState();

  const showIconOnly =
    iconOnly ??
    (editorInterface?.formFactor !== "desktop" ||
      appState.width < MQ_MIN_WIDTH_DESKTOP);

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
