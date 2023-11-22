import { Dialog } from "../Dialog";
import { useApp } from "../App";
import MermaidToExcalidraw from "../MermaidToExcalidraw";
import TTDDialogTabs from "./TTDDialogTabs";
import { useTunnels } from "../../context/tunnels";
import { ReactNode } from "react";
import { useUIAppState } from "../../context/ui-appState";
import { withInternalFallback } from "../hoc/withInternalFallback";
import { TTDDialogTabTriggers } from "./TTDDialogTabTriggers";
import { TTDDialogTabTrigger } from "./TTDDialogTabTrigger";
import { TTDDialogTab } from "./TTDDialogTab";
import "./TTDDialog.scss";
import { t } from "../../i18n";
import { TTDDialogInput } from "./TTDDialogInput";
import { TTDDialogOutput } from "./TTDDialogOutput";
import { TTDDialogPanel } from "./TTDDialogPanel";
import { TTDDialogPanels } from "./TTDDialogPanels";

/**
 * Text to diagram (TTD) dialog
 */
export const TTDDialog = Object.assign(
  withInternalFallback(
    "TTDDialog",
    ({ children, ...rest }: { children?: ReactNode; __fallback?: boolean }) => {
      const app = useApp();
      const appState = useUIAppState();
      const { TDDDialogTabTriggersTunnel } = useTunnels();

      if (
        typeof appState.openDialog === "string" ||
        appState.openDialog === null
      ) {
        return null;
      }

      return (
        <Dialog
          className="ttd-dialog"
          onCloseRequest={() => {
            app.setOpenDialog(null);
          }}
          size={1200}
          title=""
          {...rest}
        >
          <TTDDialogTabs>
            <TDDDialogTabTriggersTunnel.Out />
            {rest.__fallback && (
              <p className="dialog-mermaid-title">{t("mermaid.title")}</p>
            )}
            <TTDDialogTab className="ttd-dialog-content" tab="mermaid">
              <MermaidToExcalidraw />
            </TTDDialogTab>
            {children}
          </TTDDialogTabs>
        </Dialog>
      );
    },
  ),
  {
    TabTriggers: TTDDialogTabTriggers,
    TabTrigger: TTDDialogTabTrigger,
    Tab: TTDDialogTab,
    Input: TTDDialogInput,
    Output: TTDDialogOutput,
    Panels: TTDDialogPanels,
    Panel: TTDDialogPanel,
  },
);
