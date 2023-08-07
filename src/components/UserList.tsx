import "./UserList.scss";

import React from "react";
import clsx from "clsx";
import { AppState, Collaborator } from "../types";
import { Tooltip } from "./Tooltip";
import { useExcalidrawActionManager } from "./App";
import { ActionManager } from "../actions/manager";

import * as Popover from "@radix-ui/react-popover";
import { Island } from "./Island";

const sampleCollaborators = new Map([
  [
    "client-id-1",
    {
      username: "John Doe",
      color: "#1CA6FC",
    },
  ],
  [
    "client-id-2",
    {
      username: "Jane Doe",
      color: "#FEA3AA",
    },
  ],
  [
    "client-id-3",
    {
      username: "Kate Doe",
      color: "#B2F2BB",
    },
  ],
  [
    "client-id-4",
    {
      username: "Handsome Swan",
      color: "#FFDBAB",
    },
  ],
  [
    "client-id-5",
    {
      username: "Brilliant Chameleon",
      color: "#E2E2E2",
    },
  ],
  [
    "client-id-6",
    {
      username: "Jill Doe",
      color: "#FCCB5F",
    },
  ],
  [
    "client-id-7",
    {
      username: "Jack Doe",
      color: "#BCE784",
    },
  ],
  [
    "client-id-8",
    {
      username: "Jolly Doe",
      color: "#5DD39E",
    },
  ],
]) as any as Map<string, Collaborator>;

const FIRST_N_AVATARS = 3;

const ConditionalTooltipWrapper = ({
  shouldWrap,
  children,
  clientId,
  username,
}: {
  shouldWrap: boolean;
  children: React.ReactNode;
  username?: string | null;
  clientId: string;
}) =>
  shouldWrap ? (
    <Tooltip label={username || "Unknown user"} key={clientId}>
      {children}
    </Tooltip>
  ) : (
    <React.Fragment key={clientId}>{children}</React.Fragment>
  );

const renderCollaborator = ({
  actionManager,
  collaborator,
  clientId,
  withName = false,
  shouldWrapWithTooltip = false,
}: {
  actionManager: ActionManager;
  collaborator: Collaborator;
  clientId: string;
  withName?: boolean;
  shouldWrapWithTooltip?: boolean;
}) => {
  const avatarJSX = actionManager.renderAction("goToCollaborator", [
    clientId,
    collaborator,
    withName,
  ]);

  return (
    <ConditionalTooltipWrapper
      key={clientId}
      clientId={clientId}
      username={collaborator.username}
      shouldWrap={shouldWrapWithTooltip}
    >
      {avatarJSX}
    </ConditionalTooltipWrapper>
  );
};

export const UserList = ({
  className,
  mobile,
  collaborators,
}: {
  className?: string;
  mobile?: boolean;
  collaborators: AppState["collaborators"];
}) => {
  const actionManager = useExcalidrawActionManager();

  // const uniqueCollaboratorsMap = new Map<string, Collaborator>();
  // collaborators.forEach((collaborator, socketId) => {
  //   uniqueCollaboratorsMap.set(
  //     // filter on user id, else fall back on unique socketId
  //     collaborator.id || socketId,
  //     collaborator,
  //   );
  // });

  const uniqueCollaboratorsMap = sampleCollaborators;
  const uniqueCollaboratorsArray = Array.from(uniqueCollaboratorsMap).filter(
    ([_, collaborator]) => Object.keys(collaborator).length !== 0,
  );

  if (uniqueCollaboratorsArray.length === 0) {
    return null;
  }

  const firstThreeCollaborators = uniqueCollaboratorsArray.slice(
    0,
    FIRST_N_AVATARS,
  );

  const first3avatarsJSX = firstThreeCollaborators.map(
    ([clientId, collaborator]) =>
      renderCollaborator({
        actionManager,
        collaborator,
        clientId,
        shouldWrapWithTooltip: true,
      }),
  );

  return mobile ? (
    <div className={clsx("UserList UserList_mobile", className)}>
      {uniqueCollaboratorsArray.map(([clientId, collaborator]) =>
        renderCollaborator({
          actionManager,
          collaborator,
          clientId,
          shouldWrapWithTooltip: true,
        }),
      )}
    </div>
  ) : (
    <div className={clsx("UserList", className)}>
      {first3avatarsJSX}

      {uniqueCollaboratorsArray.length > FIRST_N_AVATARS && (
        <Popover.Root>
          <Popover.Trigger className="UserList__more">
            +{uniqueCollaboratorsArray.length - FIRST_N_AVATARS}
          </Popover.Trigger>
          <Popover.Content
            style={{ zIndex: 2, maxWidth: "14rem", textAlign: "left" }}
            align="end"
            sideOffset={10}
          >
            <Island>
              {/* TODO follow-participant */}
              <div>TODO search</div>
              <div className="dropdown-menu UserList__collaborators">
                {uniqueCollaboratorsArray.map(([clientId, collaborator]) =>
                  renderCollaborator({
                    actionManager,
                    collaborator,
                    clientId,
                    withName: true,
                  }),
                )}
              </div>
              {/* TODO follow-participant */}
              <div className="UserList__hint">
                <div className="UserList__hint-heading">TODO hint</div>
                <div className="UserList__hint-text">
                  Lorem ipsum dolor sit amet consectetur adipisicing elit.
                  Quibusdam, ipsum!
                </div>
              </div>
            </Island>
          </Popover.Content>
        </Popover.Root>
      )}
    </div>
  );
};
