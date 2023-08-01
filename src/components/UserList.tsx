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
]);

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

const renderCollaborator = ({
  actionManager,
  collaborator,
  clientId,
  mobile,
  withName = false,
}: {
  actionManager: ActionManager;
  collaborator: Collaborator;
  clientId: string;
  mobile?: boolean;
  withName?: boolean;
}) => {
  const avatarJSX = actionManager.renderAction("goToCollaborator", [
    clientId,
    collaborator,
    withName,
  ]);

  return mobile ? (
    <Tooltip label={collaborator.username || "Unknown user"} key={clientId}>
      {avatarJSX}
    </Tooltip>
  ) : (
    <React.Fragment key={clientId}>{avatarJSX}</React.Fragment>
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

  // TODO follow-participant
  // possibly make it configurable
  const firstThreeCollaborators = uniqueCollaboratorsArray.slice(0, 3);

  // TODO follow-participant
  // should we show all or just the rest in the dropdown?
  // const restCollaborators = uniqueCollaboratorsArray.slice(3);

  const first3avatarsJSX = firstThreeCollaborators.map(
    ([clientId, collaborator]) =>
      renderCollaborator({
        actionManager,
        // TODO follow-participant
        collaborator: collaborator as any,
        clientId,
        mobile,
      }),
  );

  // TODO follow-participant
  // on mobile, we can probably show all collaborators without the need for a dropdown
  return (
    <>
      <div className={clsx("UserList", className, { UserList_mobile: mobile })}>
        {first3avatarsJSX}

        {uniqueCollaboratorsArray.length > 3 && (
          <div style={{ position: "relative" }}>
            <DropdownMenu open={open}>
              <DropdownMenu.Trigger
                className="UserList__more"
                onToggle={() => {
                  setOpen(!open);
                }}
              >
                +{uniqueCollaboratorsArray.length - 3}
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
                    // TODO follow-participant
                    collaborator: collaborator as any,
                    clientId,
                    mobile,
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
