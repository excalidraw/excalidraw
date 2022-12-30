import "./UserList.scss";

import React from "react";
import clsx from "clsx";
import { Collaborator } from "../types";
import { Tooltip } from "./Tooltip";
import {
  useDevice,
  useExcalidrawActionManager,
  useExcalidrawAppState,
} from "./App";
import { t } from "../i18n";

export const UserList: React.FC<{
  className?: string;
  mobile?: boolean;
}> = ({ className, mobile }) => {
  const actionManager = useExcalidrawActionManager();
  const appState = useExcalidrawAppState();
  const device = useDevice();
  if (appState.collaborators.size === 0) {
    return null;
  }

  const uniqueCollaborators = new Map<string, Collaborator>();
  appState.collaborators.forEach((collaborator, socketId) => {
    uniqueCollaborators.set(
      // filter on user id, else fall back on unique socketId
      collaborator.id || socketId,
      collaborator,
    );
  });

  const avatars =
    uniqueCollaborators.size > 0 &&
    Array.from(uniqueCollaborators)
      .filter(([_, client]) => Object.keys(client).length !== 0)
      .map(([clientId, collaborator]) => {
        const avatarJSX = actionManager.renderAction("goToCollaborator", [
          clientId,
          collaborator,
        ]);

        return device.isMobile ? (
          <Tooltip
            label={collaborator.username || "Unknown user"}
            key={clientId}
          >
            {avatarJSX}
          </Tooltip>
        ) : (
          <React.Fragment key={clientId}>{avatarJSX}</React.Fragment>
        );
      });

  if (device.isMobile) {
    return (
      <fieldset className="UserList-Wrapper">
        <legend>{t("labels.collaborators")}</legend>
        <div className={clsx("UserList UserList_mobile", className)}>
          {avatars}
        </div>
      </fieldset>
    );
  }
  return <div className={clsx("UserList", className)}>{avatars}</div>;
};
