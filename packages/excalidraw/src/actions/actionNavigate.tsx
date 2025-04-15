import clsx from "clsx";

import { getClientColor } from "../clients";
import { Avatar } from "../components/Avatar";
import {
  eyeIcon,
  microphoneIcon,
  microphoneMutedIcon,
} from "../components/icons";
import { t } from "../i18n";
import { CaptureUpdateAction } from "../store";

import { register } from "./register";

import type { GoToCollaboratorComponentProps } from "../components/UserList";
import type { Collaborator } from "../types";

export const actionGoToCollaborator = register({
  name: "goToCollaborator",
  label: "Go to a collaborator",
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
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
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
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ updateData, data, appState }) => {
    const { socketId, collaborator, withName, isBeingFollowed } =
      data as GoToCollaboratorComponentProps;

    const background = getClientColor(socketId, collaborator);

    const statusClassNames = clsx({
      "is-followed": isBeingFollowed,
      "is-current-user": collaborator.isCurrentUser === true,
      "is-speaking": collaborator.isSpeaking,
      "is-in-call": collaborator.isInCall,
      "is-muted": collaborator.isMuted,
    });

    const statusIconJSX = collaborator.isInCall ? (
      collaborator.isSpeaking ? (
        <div
          className="UserList__collaborator-status-icon-speaking-indicator"
          title={t("userList.hint.isSpeaking")}
        >
          <div />
          <div />
          <div />
        </div>
      ) : collaborator.isMuted ? (
        <div
          className="UserList__collaborator-status-icon-microphone-muted"
          title={t("userList.hint.micMuted")}
        >
          {microphoneMutedIcon}
        </div>
      ) : (
        <div title={t("userList.hint.inCall")}>{microphoneIcon}</div>
      )
    ) : null;

    return withName ? (
      <div
        className={`dropdown-menu-item dropdown-menu-item-base UserList__collaborator ${statusClassNames}`}
        style={{ [`--avatar-size` as any]: "1.5rem" }}
        onClick={() => updateData<Collaborator>(collaborator)}
      >
        <Avatar
          color={background}
          onClick={() => {}}
          name={collaborator.username || ""}
          src={collaborator.avatarUrl}
          className={statusClassNames}
        />
        <div className="UserList__collaborator-name">
          {collaborator.username}
        </div>
        <div className="UserList__collaborator-status-icons" aria-hidden>
          {isBeingFollowed && (
            <div
              className="UserList__collaborator-status-icon-is-followed"
              title={t("userList.hint.followStatus")}
            >
              {eyeIcon}
            </div>
          )}
          {statusIconJSX}
        </div>
      </div>
    ) : (
      <div
        className={`UserList__collaborator UserList__collaborator--avatar-only ${statusClassNames}`}
      >
        <Avatar
          color={background}
          onClick={() => {
            updateData(collaborator);
          }}
          name={collaborator.username || ""}
          src={collaborator.avatarUrl}
          className={statusClassNames}
        />
        {statusIconJSX && (
          <div className="UserList__collaborator-status-icon">
            {statusIconJSX}
          </div>
        )}
      </div>
    );
  },
});
