import { DefaultSidebar } from "@excalidraw/excalidraw";
import { useAtomValue } from "../app-jotai";

import { currentClientIdAtom } from "../store/drawingState";
import { ClientList } from "./ClientList";
import { DrawingList } from "./DrawingList";

import "./AppSidebar.scss";

export const AppSidebar = () => {
  const currentClientId = useAtomValue(currentClientIdAtom);

  return (
    <DefaultSidebar>
      {currentClientId ? <DrawingList /> : <ClientList />}
    </DefaultSidebar>
  );
};
