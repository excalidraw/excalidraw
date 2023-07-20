import { getClientColor } from "../clients";
import { Avatar } from "../components/Avatar";
import { centerScrollOn } from "../scene/scroll";
import { Collaborator } from "../types";
import { register } from "./register";

export const actionGoToCollaborator = register({
  name: "goToCollaborator",
  viewMode: true,
  trackEvent: { category: "collab" },
  perform: (_elements, appState, value) => {
    const _value = value as Collaborator & { clientId: string };
    const point = _value.pointer;

    if (!point) {
      return { appState, commitToHistory: false };
    }

    return {
      appState: {
        ...appState,
        // ˇˇ or maybe an atom? 🤔
        userToFollow: _value.clientId,
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
      commitToHistory: false,
    };
  },
  PanelComponent: ({ updateData, data }) => {
    const [clientId, collaborator] = data as [string, Collaborator];

    const background = getClientColor(clientId);

    return (
      <Avatar
        color={background}
        onClick={() => updateData({ ...collaborator, clientId })}
        name={collaborator.username || ""}
        src={collaborator.avatarUrl}
      />
    );
  },
});
