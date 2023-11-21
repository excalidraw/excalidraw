import { getClientColor } from "../clients";
import { Avatar } from "../components/Avatar";
import { centerScrollOn } from "../scene/scroll";
import { Collaborator } from "../types";
import { register } from "./register";
import { StoreAction } from "./types";

export const actionGoToCollaborator = register({
  name: "goToCollaborator",
  viewMode: true,
  trackEvent: { category: "collab" },
  perform: (_elements, appState, value) => {
    const point = value as Collaborator["pointer"];
    if (!point) {
      return { appState, storeAction: StoreAction.NONE };
    }

    return {
      appState: {
        ...appState,
        ...centerScrollOn({
          scenePoint: point,
          viewportDimensions: {
            width: appState.width,
            height: appState.height,
          },
          zoom: appState.zoom,
        }),
        // Close mobile menu
        openMenu: appState.openMenu === "canvas" ? null : appState.openMenu,
      },
      storeAction: StoreAction.NONE,
    };
  },
  PanelComponent: ({ updateData, data }) => {
    const [clientId, collaborator] = data as [string, Collaborator];

    const background = getClientColor(clientId);

    return (
      <Avatar
        color={background}
        onClick={() => updateData(collaborator.pointer)}
        name={collaborator.username || ""}
        src={collaborator.avatarUrl}
      />
    );
  },
});
