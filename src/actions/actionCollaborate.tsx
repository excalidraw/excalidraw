import React from "react";
import { LiveButton } from "../components/LiveButton";
import { t } from "../i18n";
import { generateCollaborationLink, getCollaborationLinkData } from "../data";
import useIsMobile from "../is-mobile";
import { register } from "./register";

export const actionCollaborate = register({
  name: "enableCollaboration",
  perform: (_, appState, collaborationLink) => {
    if (collaborationLink) {
      window.location.href = collaborationLink;
      return { appState: { ...appState, isCollaborating: true } };
    }
    return {};
  },
  PanelComponent: ({ appState, updateData }) => (
    <LiveButton
      isLive={appState.isCollaborating}
      count={appState.collaboratorCount}
      title={t("buttons.enableCollaboration")}
      aria-label={t("buttons.enableCollaboration")}
      showAriaLabel={useIsMobile()}
      onClick={async () => {
        if (!getCollaborationLinkData(window.location.href)) {
          const collaborationLink = await generateCollaborationLink();
          updateData(collaborationLink);
        } else {
          updateData(null);
        }
      }}
    />
  ),
});
