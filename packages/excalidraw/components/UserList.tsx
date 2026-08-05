import { Popover } from "radix-ui";
import clsx from "clsx";
import React, { useLayoutEffect } from "react";

import { supportsResizeObserver, isShallowEqual } from "@excalidraw/common";

import type { MarkRequired } from "@excalidraw/common/utility-types";

import { t } from "../i18n";

import { useExcalidrawActionManager } from "./App";
import { chevronDownIcon } from "./icons";
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

// avatar (28px) + gap (10px)
const AVATAR_SLOT_WIDTH = 38;
// the current user's pill (avatar + chevron + its own padding/border) is
// wider than a plain avatar — reserving this extra width for it keeps it
// from ever being the item that tips the row over and wraps onto its own
// line (chevron 15px + pill's right padding 4px + pill's border 2px)
const PILL_EXTRA_WIDTH = 21;

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
  | "isCurrentUser"
>;

type UserListProps = {
  className?: string;
  mobile?: boolean;
  collaborators: Map<SocketId, UserListUserObject>;
  userToFollow: SocketId | null;
  currentUserControls?:
    | React.ReactNode
    | ((isMobile: boolean) => React.ReactNode);
};

const collaboratorComparatorKeys = [
  "avatarUrl",
  "id",
  "socketId",
  "username",
  "isInCall",
  "isSpeaking",
  "isMuted",
  "isCurrentUser",
] as const;

export const UserList = React.memo(
  ({
    className,
    mobile,
    collaborators,
    userToFollow,
    currentUserControls,
  }: UserListProps) => {
    const actionManager = useExcalidrawActionManager();

    const resolvedCurrentUserControls =
      typeof currentUserControls === "function"
        ? currentUserControls(!!mobile)
        : currentUserControls;

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
        const updateWrapperWidth = (width: number) => {
          setWrapperWidth(width);
        };

        updateWrapperWidth(userListWrapper.current.clientWidth);

        if (!supportsResizeObserver) {
          return;
        }

        const resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width } = entry.contentRect;
            updateWrapperWidth(width);
          }
        });

        resizeObserver.observe(userListWrapper.current);

        return () => {
          resizeObserver.disconnect();
        };
      }
    }, []);

    const [wrapperWidth, setWrapperWidth] = React.useState(
      DEFAULT_MAX_AVATARS * AVATAR_SLOT_WIDTH,
    );

    const currentUser = uniqueCollaboratorsArray.find((c) => c.isCurrentUser);
    const otherCollaborators = uniqueCollaboratorsArray.filter(
      (c) => !c.isCurrentUser,
    );

    // the current user's avatar is always shown, reserved as the last
    // slot — it's the single entry point for the collaborators +
    // currentUserControls dropdown, so it's never hidden by/counted in
    // overflow. Its width (wider than a plain avatar) is carved out of the
    // available width up front so it always shares a row with the other
    // avatars — if there's only room for the pill itself, it renders alone
    // rather than wrapping onto its own line.
    const availableWidth = currentUser
      ? wrapperWidth - PILL_EXTRA_WIDTH
      : wrapperWidth;
    const totalSlots = Math.max(
      1,
      Math.min(8, Math.floor(availableWidth / AVATAR_SLOT_WIDTH)),
    );
    const otherSlots = currentUser ? Math.max(0, totalSlots - 1) : totalSlots;
    const visibleOthers = otherCollaborators.slice(0, otherSlots);

    const firstNCollaborators = currentUser
      ? [...visibleOthers, currentUser]
      : visibleOthers;

    const firstNAvatarsJSX = firstNCollaborators.map((collaborator) => {
      const avatarJSX = renderCollaborator({
        actionManager,
        collaborator,
        socketId: collaborator.socketId,
        shouldWrapWithTooltip: true,
        isBeingFollowed: collaborator.socketId === userToFollow,
      });

      if (!collaborator.isCurrentUser) {
        return avatarJSX;
      }

      // current user's avatar is the single entry point for the "who's
      // here" list + currentUserControls dropdown
      return (
        <Popover.Root key={collaborator.socketId}>
          <Popover.Trigger asChild>
            <div className="UserList__pill">
              {avatarJSX}
              <div className="UserList__pill-chevron">{chevronDownIcon}</div>
            </div>
          </Popover.Trigger>
          <Popover.Content
            className="focus-visible-none"
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
                      filteredCollaborators.map((c) =>
                        renderCollaborator({
                          actionManager,
                          collaborator: c,
                          socketId: c.socketId,
                          withName: true,
                          isBeingFollowed: c.socketId === userToFollow,
                        }),
                      ),
                    ]
                  : []}
              </ScrollableList>
              {resolvedCurrentUserControls && (
                <>
                  <div className="UserList__menu-divider" />
                  <Popover.Close asChild>
                    <div className="dropdown-menu">
                      {resolvedCurrentUserControls}
                    </div>
                  </Popover.Close>
                </>
              )}
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
      );
    });

    return mobile ? (
      <div className={clsx("UserList UserList_mobile", className)}>
        <div className="UserList_mobile__avatars">
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
        {resolvedCurrentUserControls && (
          <>
            <div className="UserList__menu-divider" />
            {resolvedCurrentUserControls}
          </>
        )}
      </div>
    ) : (
      <div className="UserList__wrapper" ref={userListWrapper}>
        <div
          className={clsx("UserList", className)}
          style={{
            [`--max-avatars` as any]:
              firstNCollaborators.length +
              (currentUser ? PILL_EXTRA_WIDTH / AVATAR_SLOT_WIDTH : 0),
          }}
        >
          {firstNAvatarsJSX}
        </div>
      </div>
    );
  },
  (prev, next) => {
    if (
      prev.collaborators.size !== next.collaborators.size ||
      prev.mobile !== next.mobile ||
      prev.className !== next.className ||
      prev.userToFollow !== next.userToFollow ||
      prev.currentUserControls !== next.currentUserControls
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
