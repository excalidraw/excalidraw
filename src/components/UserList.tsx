import "./UserList.scss";

import React from "react";
import clsx from "clsx";
import { AppState, Collaborator } from "../types";
import { Tooltip } from "./Tooltip";
import { useExcalidrawActionManager } from "./App";
import DropdownMenu from "./dropdownMenu/DropdownMenu";
import { ActionManager } from "../actions/manager";

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
]) as any as Map<string, Collaborator>;

export const __UserList: React.FC<{
  className?: string;
  mobile?: boolean;
  collaborators: AppState["collaborators"];
}> = ({ className, mobile, collaborators }) => {
  const actionManager = useExcalidrawActionManager();

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

  return (
    <div className={clsx("UserList", className, { UserList_mobile: mobile })}>
      {avatars}
    </div>
  );
};

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

  const [open, setOpen] = React.useState(false);

  const uniqueCollaboratorsMap = new Map<string, Collaborator>();
  collaborators.forEach((collaborator, socketId) => {
    uniqueCollaboratorsMap.set(
      // filter on user id, else fall back on unique socketId
      collaborator.id || socketId,
      collaborator,
    );
  });

  // const uniqueCollaboratorsMap = sampleCollaborators;
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

  if (mobile) {
    return (
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
    );
  }

  return (
    <>
      <div className={clsx("UserList", className)}>
        {first3avatarsJSX}

        {uniqueCollaboratorsArray.length > FIRST_N_AVATARS && (
          <div style={{ position: "relative" }}>
            <DropdownMenu open={open}>
              <DropdownMenu.Trigger
                className="UserList__more"
                onToggle={() => {
                  setOpen(!open);
                }}
              >
                +{uniqueCollaboratorsArray.length - FIRST_N_AVATARS}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content
                style={{ width: "10rem" }}
                onClickOutside={() => {
                  setOpen(false);
                }}
              >
                {uniqueCollaboratorsArray.map(([clientId, collaborator]) =>
                  renderCollaborator({
                    actionManager,
                    collaborator,
                    clientId,
                    withName: true,
                  }),
                )}
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
        )}
      </div>
    </>
  );
};
