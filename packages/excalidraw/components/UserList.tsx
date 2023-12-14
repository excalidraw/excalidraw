import "./UserList.scss";

import React from "react";
import clsx from "clsx";
import { AppState, Collaborator } from "../types";
import { Tooltip } from "./Tooltip";
import { useExcalidrawActionManager } from "./App";
import { ActionManager } from "../actions/manager";

import * as Popover from "@radix-ui/react-popover";
import { Island } from "./Island";
import { searchIcon } from "./icons";
import { t } from "../i18n";

const FIRST_N_AVATARS = 3;
const SHOW_COLLABORATORS_FILTER_AT = 6;

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

  const uniqueCollaboratorsMap = React.useMemo(() => {
    const map = new Map<string, Collaborator>();
    collaborators.forEach((collaborator, socketId) => {
      map.set(
        // filter on user id, else fall back on unique socketId
        collaborator.id || socketId,
        { ...collaborator, socketId },
      );
    });
    return map;
  }, [collaborators]);

  // const uniqueCollaboratorsMap = sampleCollaborators;
  const uniqueCollaboratorsArray = React.useMemo(
    () =>
      Array.from(uniqueCollaboratorsMap).filter(
        ([_, collaborator]) => Object.keys(collaborator).length !== 1,
      ),
    [uniqueCollaboratorsMap],
  );

  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredCollaborators = React.useMemo(
    () =>
      uniqueCollaboratorsArray.filter(([, collaborator]) =>
        collaborator.username?.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [uniqueCollaboratorsArray, searchTerm],
  );

  if (uniqueCollaboratorsArray.length === 0) {
    return null;
  }

  const firstNCollaborators = uniqueCollaboratorsArray.slice(
    0,
    FIRST_N_AVATARS,
  );

  const firstNAvatarsJSX = firstNCollaborators.map(([clientId, collaborator]) =>
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
      {firstNAvatarsJSX}

      {uniqueCollaboratorsArray.length > FIRST_N_AVATARS && (
        <Popover.Root
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setSearchTerm("");
            }
          }}
        >
          <Popover.Trigger className="UserList__more">
            +{uniqueCollaboratorsArray.length - FIRST_N_AVATARS}
          </Popover.Trigger>
          <Popover.Content
            style={{ zIndex: 2, maxWidth: "14rem", textAlign: "left" }}
            align="end"
            sideOffset={10}
          >
            <Island style={{ overflow: "hidden" }}>
              {SHOW_COLLABORATORS_FILTER_AT <=
                uniqueCollaboratorsArray.length && (
                <div className="UserList__search-wrapper">
                  {searchIcon}
                  <input
                    className="UserList__search"
                    type="text"
                    placeholder={t("userList.search.placeholder")}
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                    }}
                  />
                </div>
              )}
              <div className="dropdown-menu UserList__collaborators">
                {filteredCollaborators.length === 0 && (
                  <div className="UserList__collaborators__empty">
                    {t("userList.search.empty")}
                  </div>
                )}
                {filteredCollaborators.map(([clientId, collaborator]) =>
                  renderCollaborator({
                    actionManager,
                    collaborator,
                    clientId,
                    withName: true,
                  }),
                )}
              </div>
              <div className="UserList__hint">
                <div className="UserList__hint-heading">
                  {t("userList.hint.heading")}
                </div>
                <div className="UserList__hint-text">
                  {t("userList.hint.text")}
                </div>
              </div>
            </Island>
          </Popover.Content>
        </Popover.Root>
      )}
    </div>
  );
};
