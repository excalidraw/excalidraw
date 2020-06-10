import React from "react";
import { Avatar } from "../components/Avatar";
import { register } from "./register";
import { getClientColors, getClientShortName } from "../clients";

export const actionGoToCollaborator = register({
  name: "goToCollaborator",
  perform: (_elements, appState, value) => {
    return {
      appState: {
        ...appState,
        // scrollX:
        // openMenu: appState.openMenu === "canvas" ? null : "canvas",
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
      <Avatar color={background} onClick={() => {}}>
        {shortName}
      </Avatar>
    );
  },
});
