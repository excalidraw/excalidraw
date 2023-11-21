import * as RadixTabs from "@radix-ui/react-tabs";
import { ReactNode } from "react";
import { useUIAppState } from "../../context/ui-appState";
import { useExcalidrawSetAppState } from "../App";

const TTDDialogTabs = ({ children, ...rest }: { children: ReactNode }) => {
  const appState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();

  if (typeof appState.openDialog === "string" || appState.openDialog === null) {
    return null;
  }

  const { name } = appState.openDialog;

  return (
    <RadixTabs.Root
      className="ttd-dialog-tabs-root"
      value={appState.openDialog.tab}
      onValueChange={(tab) =>
        setAppState((state) => ({
          ...state,
          // @ts-ignore
          openDialog: { ...state.openDialog, name, tab },
        }))
      }
      {...rest}
    >
      {children}
    </RadixTabs.Root>
  );
};

TTDDialogTabs.displayName = "TTDDialogTabs";

export default TTDDialogTabs;
