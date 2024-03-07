import { getClientColor } from "../clients";
import { Avatar } from "../components/Avatar";
import { GoToCollaboratorComponentProps } from "../components/UserList";
import { eyeIcon } from "../components/icons";
import { t } from "../i18n";
import { Collaborator } from "../types";
import { register } from "./register";
import { StoreAction } from "./types";

export const actionGoToCollaborator = register({
  name: "goToCollaborator",
  viewMode: true,
  trackEvent: { category: "collab" },
  perform: (_elements, appState, collaborator: Collaborator) => {
    if (
      !collaborator.socketId ||
      appState.userToFollow?.socketId === collaborator.socketId ||
      collaborator.isCurrentUser
    ) {
      return {
        appState: {
          ...appState,
          userToFollow: null,
        },
        storeAction: StoreAction.NONE,
      };
    }

    return {
      appState: {
        ...appState,
        userToFollow: {
          socketId: collaborator.socketId,
          username: collaborator.username || "",
        },
        // Close mobile menu
        openMenu: appState.openMenu === "canvas" ? null : appState.openMenu,
      },
      storeAction: StoreAction.NONE,
    };
  },
  PanelComponent: ({ updateData, data, appState }) => {
    const { clientId, collaborator, withName, isBeingFollowed } =
      data as GoToCollaboratorComponentProps;

    const background = getClientColor(clientId);

    return withName ? (
      <div
        className="dropdown-menu-item dropdown-menu-item-base UserList__collaborator"
        onClick={() => updateData<Collaborator>(collaborator)}
      >
        <Avatar
          color={background}
          onClick={() => {}}
          name={collaborator.username || ""}
          src={collaborator.avatarUrl}
          isBeingFollowed={isBeingFollowed}
          isCurrentUser={collaborator.isCurrentUser === true}
        />
        <div className="UserList__collaborator-name">
          {collaborator.username}
        </div>
        <div
          className="UserList__collaborator-follow-status-icon"
          style={{ visibility: isBeingFollowed ? "visible" : "hidden" }}
          title={isBeingFollowed ? t("userList.hint.followStatus") : undefined}
          aria-hidden
        >
          {eyeIcon}
        </div>
      </div>
    ) : (
      <Avatar
        color={background}
        onClick={() => {
          updateData(collaborator);
        }}
        name={collaborator.username || ""}
        src={collaborator.avatarUrl}
        isBeingFollowed={isBeingFollowed}
        isCurrentUser={collaborator.isCurrentUser === true}
      />
    );
  },
});
