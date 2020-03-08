import React from "react";
import { share } from "../components/icons";
import { ToolButton } from "../components/ToolButton";
import { t } from "../i18n";
import {
  generateCollaborationLink,
  getCollaborationLinkData,
} from "../scene/data";
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
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={share}
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
