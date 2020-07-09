import React from "react";
import { Avatar } from "../components/Avatar";
import { register } from "./register";
import { getClientColors, getClientInitials } from "../clients";
import { Collaborator } from "../types";
import { normalizeScroll } from "../scene";

export const actionGoToCollaborator = register({
  name: "goToCollaborator",
  perform: (_elements, appState, value) => {
    const point = value as Collaborator["pointer"];
    if (!point) {
      return { appState, commitToHistory: false };
    }

    return {
      appState: {
        ...appState,
        scrollX: normalizeScroll(appState.width / 2 - point.x),
        scrollY: normalizeScroll(appState.height / 2 - point.y),
        // Close mobile menu
        openMenu: appState.openMenu === "canvas" ? null : appState.openMenu,
      },
      commitToHistory: false,
    };
  },
  PanelComponent: ({ appState, updateData, id }) => {
    const clientId = id;

    if (!clientId) {
      return null;
    }

    const collaborator = appState.collaborators.get(clientId);

    if (!collaborator) {
      return null;
    }

    const { background } = getClientColors(clientId);
    const shortName = getClientInitials(collaborator.username);

    return (
      <Avatar
        color={background}
        onClick={() => updateData(collaborator.pointer)}
      >
        {shortName}
      </Avatar>
    );
  },
});
