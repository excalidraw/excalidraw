import { t } from "../../i18n";
import { ArrowRightIcon } from "../icons";

import { TTDDialogPanel } from "./TTDDialogPanel";
import { TTDDialogOutput } from "./TTDDialogOutput";

import type { TTDPanelAction } from "./TTDDialogPanel";
import type { MermaidToExcalidrawLibProps } from "./types";

interface TTDPreviewPanelProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  error: Error | null;
  loadStatus: MermaidToExcalidrawLibProps["status"];
  loadErrorReloadRequired?: boolean;
  onRetryLoad?: () => void;
  onInsert: () => void;
  hideErrorDetails?: boolean;
}

export const TTDPreviewPanel = ({
  canvasRef,
  error,
  loadStatus,
  loadErrorReloadRequired,
  onRetryLoad,
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
        loadStatus={loadStatus}
        loadErrorReloadRequired={loadErrorReloadRequired}
        onRetryLoad={onRetryLoad}
        hideErrorDetails={hideErrorDetails}
      />
    </TTDDialogPanel>
  );
};
