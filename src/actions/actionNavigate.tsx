import React from "react";
import { Avatar } from "../components/Avatar";
import { register } from "./register";
import { getClientColors, getClientShortName } from "../clients";
import { Collaborator, FlooredNumber } from "../types";
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
        scrollX: normalizeScroll(window.innerWidth / 2 - point.x),
        scrollY: normalizeScroll(window.innerHeight / 2 - point.y),
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
    console.log("collaborator", collaborator);
    const { background } = getClientColors(clientId);
    // @TODO: If no name? unknown? Username generation on session join like Google? 'Funky Penguin'
    const shortName = getClientShortName(collaborator.username || "?");

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
