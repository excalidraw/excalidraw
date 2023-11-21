import { useTunnels } from "../../context/tunnels";
import * as RadixTabs from "@radix-ui/react-tabs";

export const TTDDialogTabTriggers = ({
  children,
  ...rest
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => {
  const { TDDDialogTabTriggersTunnel } = useTunnels();
  return (
    <TDDDialogTabTriggersTunnel.In>
      <RadixTabs.List className="ttd-dialog-triggers" {...rest}>
        {children}
      </RadixTabs.List>
    </TDDDialogTabTriggersTunnel.In>
  );
};
TTDDialogTabTriggers.displayName = "TTDDialogTabTriggers";
