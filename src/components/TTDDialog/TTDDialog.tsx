import * as RadixTabs from "@radix-ui/react-tabs";
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
            console.log("close");
            app.setOpenDialog(null);
          }}
          size={1200}
          title=""
          {...rest}
        >
          <TTDDialogTabs>
            <TDDDialogTabTriggersTunnel.Out />
            {rest.__fallback && "mermaid csoda"}
            <RadixTabs.Content className="ttd-dialog-content" value="mermaid">
              <MermaidToExcalidraw />
            </RadixTabs.Content>
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
  },
);
