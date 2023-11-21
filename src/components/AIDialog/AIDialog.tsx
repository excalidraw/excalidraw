import * as RadixTabs from "@radix-ui/react-tabs";
import { Dialog } from "../Dialog";
import { useApp } from "../App";
import MermaidToExcalidraw from "../MermaidToExcalidraw";
import AIDialogTabs from "./AIDialogTabs";
import { useTunnels } from "../../context/tunnels";
import { ReactNode } from "react";
import { useUIAppState } from "../../context/ui-appState";
import { withInternalFallback } from "../hoc/withInternalFallback";
import { AIDialogTabTriggers } from "./AIDialogTabTriggers";
import { AIDialogTabTrigger } from "./AIDialogTabTrigger";
import { AIDialogTab } from "./AIDialogTab";

export const AIDialog = Object.assign(
  withInternalFallback(
    "AIDialog",
    ({ children, ...rest }: { children?: ReactNode; __fallback?: boolean }) => {
      const app = useApp();
      const appState = useUIAppState();
      const { AIDialogTabTriggersTunnel } = useTunnels();

      if (
        typeof appState.openDialog === "string" ||
        appState.openDialog === null
      ) {
        return null;
      }

      return (
        <Dialog
          className="ai-dialog"
          onCloseRequest={() => {
            console.log("close");
            app.setOpenDialog(null);
          }}
          size={1200}
          title=""
          {...rest}
        >
          <AIDialogTabs>
            <AIDialogTabTriggersTunnel.Out />
            {rest.__fallback && "mermaid csoda"}
            <RadixTabs.Content className="ai-dialog-content" value="mermaid">
              <MermaidToExcalidraw />
            </RadixTabs.Content>
            {children}
          </AIDialogTabs>
        </Dialog>
      );
    },
  ),
  {
    TabTriggers: AIDialogTabTriggers,
    TabTrigger: AIDialogTabTrigger,
    Tab: AIDialogTab,
  },
);
