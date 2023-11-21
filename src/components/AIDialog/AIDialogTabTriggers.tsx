import { useTunnels } from "../../context/tunnels";
import * as RadixTabs from "@radix-ui/react-tabs";

export const AIDialogTabTriggers = ({
  children,
  ...rest
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => {
  const { AIDialogTabTriggersTunnel } = useTunnels();
  return (
    <AIDialogTabTriggersTunnel.In>
      <RadixTabs.List className="ai-dialog-triggers" {...rest}>
        {children}
      </RadixTabs.List>
    </AIDialogTabTriggersTunnel.In>
  );
};
AIDialogTabTriggers.displayName = "AIDialogTabTriggers";
