import "./UserList.scss";

import React, { useLayoutEffect } from "react";
import clsx from "clsx";
import type { Collaborator, SocketId } from "../types";
import { Tooltip } from "./Tooltip";
import { useExcalidrawActionManager } from "./App";
import type { ActionManager } from "../actions/manager";

import * as Popover from "@radix-ui/react-popover";
import { Island } from "./Island";
import { searchIcon } from "./icons";
import { t } from "../i18n";
import { isShallowEqual } from "../utils";
import { supportsResizeObserver } from "../constants";
import type { MarkRequired } from "../utility-types";

export type GoToCollaboratorComponentProps = {
  socketId: SocketId;
  collaborator: Collaborator;
  withName: boolean;
  isBeingFollowed: boolean;
};

/** collaborator user id or socket id (fallback) */
type ClientId = string & { _brand: "UserId" };

const DEFAULT_MAX_AVATARS = 4;
const SHOW_COLLABORATORS_FILTER_AT = 8;

const ConditionalTooltipWrapper = ({
  shouldWrap,
  children,
  username,
}: {
  shouldWrap: boolean;
  children: React.ReactNode;
  username?: string | null;
}) =>
  shouldWrap ? (
    <Tooltip label={username || "Unknown user"}>{children}</Tooltip>
  ) : (
    <React.Fragment>{children}</React.Fragment>
  );

const renderCollaborator = ({
  actionManager,
  collaborator,
  socketId,
  withName = false,
  shouldWrapWithTooltip = false,
  isBeingFollowed,
}: {
  actionManager: ActionManager;
  collaborator: Collaborator;
  socketId: SocketId;
  withName?: boolean;
  shouldWrapWithTooltip?: boolean;
  isBeingFollowed: boolean;
}) => {
  const data: GoToCollaboratorComponentProps = {
    socketId,
    collaborator,
    withName,
    isBeingFollowed,
  };
  const avatarJSX = actionManager.renderAction("goToCollaborator", data);

  return (
    <ConditionalTooltipWrapper
      key={socketId}
      username={collaborator.username}
      shouldWrap={shouldWrapWithTooltip}
    >
      {avatarJSX}
    </ConditionalTooltipWrapper>
  );
};

type UserListUserObject = Pick<
  Collaborator,
  | "avatarUrl"
  | "id"
  | "socketId"
  | "username"
  | "isInCall"
  | "isSpeaking"
  | "isMuted"
>;

type UserListProps = {
  className?: string;
  mobile?: boolean;
  collaborators: Map<SocketId, UserListUserObject>;
  userToFollow: SocketId | null;
};

const collaboratorComparatorKeys = [
  "avatarUrl",
  "id",
  "socketId",
  "username",
  "isInCall",
  "isSpeaking",
  "isMuted",
] as const;

export const UserList = React.memo(
  ({ className, mobile, collaborators, userToFollow }: UserListProps) => {
    const actionManager = useExcalidrawActionManager();

    const uniqueCollaboratorsMap = new Map<
      ClientId,
      MarkRequired<Collaborator, "socketId">
    >();

    collaborators.forEach((collaborator, socketId) => {
      const userId = (collaborator.id || socketId) as ClientId;
      uniqueCollaboratorsMap.set(
        // filter on user id, else fall back on unique socketId
        userId,
        { ...collaborator, socketId },
      );
    });

    const uniqueCollaboratorsArray = Array.from(
      uniqueCollaboratorsMap.values(),
    ).filter((collaborator) => collaborator.username?.trim());

    const [searchTerm, setSearchTerm] = React.useState("");

    const userListWrapper = React.useRef<HTMLDivElement | null>(null);

    useLayoutEffect(() => {
      if (userListWrapper.current) {
        const updateMaxAvatars = (width: number) => {
          const maxAvatars = Math.max(1, Math.min(8, Math.floor(width / 38)));
          setMaxAvatars(maxAvatars);
        };

        updateMaxAvatars(userListWrapper.current.clientWidth);

        if (!supportsResizeObserver) {
          return;
        }

        const resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width } = entry.contentRect;
            updateMaxAvatars(width);
          }
        });

        resizeObserver.observe(userListWrapper.current);

        return () => {
          resizeObserver.disconnect();
        };
      }
    }, []);

    const [maxAvatars, setMaxAvatars] = React.useState(DEFAULT_MAX_AVATARS);

    const searchTermNormalized = searchTerm.trim().toLowerCase();

    const filteredCollaborators = searchTermNormalized
      ? uniqueCollaboratorsArray.filter((collaborator) =>
          collaborator.username?.toLowerCase().includes(searchTerm),
        )
      : uniqueCollaboratorsArray;

    const firstNCollaborators = uniqueCollaboratorsArray.slice(
      0,
      maxAvatars - 1,
    );

    const firstNAvatarsJSX = firstNCollaborators.map((collaborator) =>
      renderCollaborator({
        actionManager,
        collaborator,
        socketId: collaborator.socketId,
        shouldWrapWithTooltip: true,
        isBeingFollowed: collaborator.socketId === userToFollow,
      }),
    );

    return mobile ? (
      <div className={clsx("UserList UserList_mobile", className)}>
        {uniqueCollaboratorsArray.map((collaborator) =>
          renderCollaborator({
            actionManager,
            collaborator,
            socketId: collaborator.socketId,
            shouldWrapWithTooltip: true,
            isBeingFollowed: collaborator.socketId === userToFollow,
          }),
        )}
      </div>
    ) : (
      <div className="UserList-wrapper" ref={userListWrapper}>
        <div
          className={clsx("UserList", className)}
          style={{ [`--max-avatars` as any]: maxAvatars }}
        >
          {firstNAvatarsJSX}

          {uniqueCollaboratorsArray.length > maxAvatars - 1 && (
            <Popover.Root
              onOpenChange={(isOpen) => {
                if (!isOpen) {
                  setSearchTerm("");
                }
              }}
            >
              <Popover.Trigger className="UserList__more">
                +{uniqueCollaboratorsArray.length - maxAvatars + 1}
              </Popover.Trigger>
              <Popover.Content
                style={{
                  zIndex: 2,
                  width: "15rem",
                  textAlign: "left",
                }}
                align="end"
                sideOffset={10}
              >
                <Island style={{ overflow: "hidden" }}>
                  {uniqueCollaboratorsArray.length >=
                    SHOW_COLLABORATORS_FILTER_AT && (
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
                    <div className="UserList__hint">
                      {t("userList.hint.text")}
                    </div>
                    {filteredCollaborators.map((collaborator) =>
                      renderCollaborator({
                        actionManager,
                        collaborator,
                        socketId: collaborator.socketId,
                        withName: true,
                        isBeingFollowed: collaborator.socketId === userToFollow,
                      }),
                    )}
                  </div>
                </Island>
              </Popover.Content>
            </Popover.Root>
          )}
        </div>
      </div>
    );
  },
  (prev, next) => {
    if (
      prev.collaborators.size !== next.collaborators.size ||
      prev.mobile !== next.mobile ||
      prev.className !== next.className ||
      prev.userToFollow !== next.userToFollow
    ) {
      return false;
    }

    const nextCollaboratorSocketIds = next.collaborators.keys();

    for (const [socketId, collaborator] of prev.collaborators) {
      const nextCollaborator = next.collaborators.get(socketId);
      if (
        !nextCollaborator ||
        // this checks order of collaborators in the map is the same
        // as previous render
        socketId !== nextCollaboratorSocketIds.next().value ||
        !isShallowEqual(
          collaborator,
          nextCollaborator,
          collaboratorComparatorKeys,
        )
      ) {
        return false;
      }
    }
    return true;
  },
);
