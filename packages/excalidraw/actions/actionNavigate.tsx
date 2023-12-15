import { getClientColor } from "../clients";
import { Avatar } from "../components/Avatar";
import { Collaborator } from "../types";
import { register } from "./register";

export const actionGoToCollaborator = register({
  name: "goToCollaborator",
  viewMode: true,
  trackEvent: { category: "collab" },
  perform: (_elements, appState, collaborator: Collaborator) => {
    if (appState.userToFollow?.socketId === collaborator.socketId) {
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
          socketId: collaborator.socketId!,
          username: collaborator.username || "",
        },
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
          isBeingFollowed={appState.userToFollow?.socketId === clientId}
        />
        {collaborator.username}
      </div>
    ) : (
      <Avatar
        color={background}
        onClick={() => {
          updateData({ ...collaborator, clientId });
        }}
        name={collaborator.username || ""}
        src={collaborator.avatarUrl}
        isBeingFollowed={appState.userToFollow?.socketId === clientId}
      />
    );
  },
});
