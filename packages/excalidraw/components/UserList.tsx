import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import React, { useLayoutEffect } from "react";

import { supportsResizeObserver, isShallowEqual } from "@excalidraw/common";

import type { MarkRequired } from "@excalidraw/common/utility-types";

import { t } from "../i18n";

import { useExcalidrawActionManager } from "./App";
import { Island } from "./Island";
import { QuickSearch } from "./QuickSearch";
import { ScrollableList } from "./ScrollableList";
import { Tooltip } from "./Tooltip";

import "./UserList.scss";

import type { ActionManager } from "../actions/manager";
import type { Collaborator, SocketId } from "../types";

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
    <>{children}</>
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
    const filteredCollaborators = uniqueCollaboratorsArray.filter(
      (collaborator) =>
        collaborator.username?.toLowerCase().includes(searchTerm),
    );

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
      <div className="UserList__wrapper" ref={userListWrapper}>
        <div
          className={clsx("UserList", className)}
          style={{ [`--max-avatars` as any]: maxAvatars }}
        >
          {firstNAvatarsJSX}

          {uniqueCollaboratorsArray.length > maxAvatars - 1 && (
            <Popover.Root>
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
                <Island padding={2}>
                  {uniqueCollaboratorsArray.length >=
                    SHOW_COLLABORATORS_FILTER_AT && (
                    <QuickSearch
                      placeholder={t("quickSearch.placeholder")}
                      onChange={setSearchTerm}
                    />
                  )}
                  <ScrollableList
                    className={"dropdown-menu UserList__collaborators"}
                    placeholder={t("userList.empty")}
                  >
                    {/* The list checks for `Children.count()`, hence defensively returning empty list */}
                    {filteredCollaborators.length > 0
                      ? [
                          <div className="hint">{t("userList.hint.text")}</div>,
                          filteredCollaborators.map((collaborator) =>
                            renderCollaborator({
                              actionManager,
                              collaborator,
                              socketId: collaborator.socketId,
                              withName: true,
                              isBeingFollowed:
                                collaborator.socketId === userToFollow,
                            }),
                          ),
                        ]
                      : []}
                  </ScrollableList>
                  <Popover.Arrow
                    width={20}
                    height={10}
                    style={{
                      fill: "var(--popup-bg-color)",
                      filter: "drop-shadow(rgba(0, 0, 0, 0.05) 0px 3px 2px)",
                    }}
                  />
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
