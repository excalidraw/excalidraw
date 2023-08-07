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

    if (appState.userToFollow?.clientId === _value.clientId) {
      return {
        appState: {
          ...appState,
          userToFollow: null,
        },
        commitToHistory: false,
      };
    }

    return {
      appState: {
        ...appState,
        userToFollow: {
          clientId: _value.clientId,
          username: _value.username || "",
        },
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
  PanelComponent: ({ updateData, data, appState }) => {
    const [clientId, collaborator, withName] = data as [
      string,
      Collaborator,
      boolean,
    ];

    const background = getClientColor(clientId);

    return withName ? (
      <div
        className="dropdown-menu-item dropdown-menu-item-base"
        onClick={() => updateData({ ...collaborator, clientId })}
      >
        <Avatar
          color={background}
          onClick={() => {}}
          name={collaborator.username || ""}
          src={collaborator.avatarUrl}
          isBeingFollowed={appState.userToFollow?.clientId === clientId}
        />
        {collaborator.username}
      </div>
    ) : (
      <Avatar
        color={background}
        onClick={() => updateData({ ...collaborator, clientId })}
        name={collaborator.username || ""}
        src={collaborator.avatarUrl}
        isBeingFollowed={appState.userToFollow?.clientId === clientId}
      />
    );
  },
});
