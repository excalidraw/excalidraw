import { t } from "../../i18n";
import { ArrowRightIcon } from "../icons";

import { TTDDialogPanel } from "./TTDDialogPanel";
import { TTDDialogOutput } from "./TTDDialogOutput";

import type { TTDPanelAction } from "./TTDDialogPanel";

interface TTDPreviewPanelProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  error: Error | null;
  loaded: boolean;
  onInsert: () => void;
  hideErrorDetails?: boolean;
}

export const TTDPreviewPanel = ({
  canvasRef,
  error,
  loaded,
  onInsert,
  hideErrorDetails,
}: TTDPreviewPanelProps) => {
  const actions: TTDPanelAction[] = [
    {
      action: onInsert,
      label: t("chat.insert"),
      icon: ArrowRightIcon,
      variant: "button",
    },
  ];

  return (
    <TTDDialogPanel
      panelActionJustifyContent="flex-end"
      panelActions={actions}
      className="ttd-dialog-preview-panel"
    >
      <TTDDialogOutput
        canvasRef={canvasRef}
        error={error}
        loaded={loaded}
        hideErrorDetails={hideErrorDetails}
      />
    </TTDDialogPanel>
  );
};
