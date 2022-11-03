import "./UserList.scss";

import React from "react";
import clsx from "clsx";
import { AppState, Collaborator } from "../types";
import { Tooltip } from "./Tooltip";
import { ActionManager } from "../actions/manager";

export const UserList: React.FC<{
  className?: string;
  mobile?: boolean;
  collaborators: AppState["collaborators"];
  actionManager: ActionManager;
}> = ({ className, mobile, collaborators, actionManager }) => {
  const uniqueCollaborators = new Map<string, Collaborator>();

  collaborators.forEach((collaborator, socketId) => {
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

        return mobile ? (
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

  // TODO barnabasmolnar/editor-redesign
  // probably remove before shipping :)
  // 20 fake collaborators; for easy, convenient debug purposes ˇˇ
  // const avatars = Array.from({ length: 20 }).map((_, index) => {
  //   const avatarJSX = actionManager.renderAction("goToCollaborator", [
  //     index.toString(),
  //     {
  //       username: `User ${index}`,
  //     },
  //   ]);

  //   return mobile ? (
  //     <Tooltip label={`User ${index}`} key={index}>
  //       {avatarJSX}
  //     </Tooltip>
  //   ) : (
  //     <React.Fragment key={index}>{avatarJSX}</React.Fragment>
  //   );
  // });

  return (
    <div className={clsx("UserList", className, { UserList_mobile: mobile })}>
      {avatars}
    </div>
  );
};
