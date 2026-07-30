import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { Collaborator, SocketId } from "./types";

export const REVIEW_REACTIONS = ["thumbsUp", "check", "eyes"] as const;

export type ReviewReaction = typeof REVIEW_REACTIONS[number];

export type ReviewUser = Readonly<{
  id: string;
  username: string;
  avatarUrl?: string;
}>;

export type ReviewComment = Readonly<{
  id: string;
  author: ReviewUser;
  body: string;
  created: number;
  mentions: readonly string[];
  reactions: Partial<Record<ReviewReaction, readonly string[]>>;
}>;

export type ReviewThread = Readonly<{
  id: string;
  elementId: string;
  comments: readonly ReviewComment[];
  created: number;
  updated: number;
  resolved: boolean;
  resolvedBy?: ReviewUser;
  resolvedAt?: number;
}>;

export type ReviewNotification = Readonly<{
  id: string;
  userId: string;
  threadId: string;
  commentId: string;
  elementId: string;
  type: "mention" | "reply";
  actor: ReviewUser;
  created: number;
  read: boolean;
}>;

export type ContributorActivity = Readonly<{
  user: ReviewUser;
  lastContributionAt: number;
}>;

export type ElementReviewAttribution = Readonly<{
  createdBy: ReviewUser;
  createdAt: number;
  lastEditedBy: ReviewUser;
  lastEditedAt: number;
}>;

export type ReviewData = Readonly<{
  currentUser: ReviewUser | null;
  threads: readonly ReviewThread[];
  notifications: readonly ReviewNotification[];
  contributors: Record<string, ContributorActivity>;
}>;

export type ReviewCommentInput = Readonly<{
  threadId?: string;
  elementId: string;
  body: string;
  author: ReviewUser;
  created?: number;
  collaborators?: Map<SocketId, Collaborator>;
}>;

export const getDefaultReviewData = (): ReviewData => ({
  currentUser: null,
  threads: [],
  notifications: [],
  contributors: {},
});

const now = () => Date.now();

const createId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}-${now().toString(36)}`;

export const getReviewUserId = (user: Pick<ReviewUser, "id" | "username">) =>
  user.id || user.username.trim().toLowerCase();

export const collaboratorToReviewUser = (
  socketId: SocketId,
  collaborator: Collaborator,
): ReviewUser => ({
  id: collaborator.id || socketId,
  username: collaborator.username || "Unknown user",
  ...(collaborator.avatarUrl ? { avatarUrl: collaborator.avatarUrl } : null),
});

export const parseReviewMentions = (body: string): string[] => {
  const mentions = new Set<string>();
  const matcher = /(^|[^\w])@([a-zA-Z0-9_.-]+)/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(body))) {
    mentions.add(match[2].toLowerCase());
  }

  return Array.from(mentions);
};

export const touchReviewContributor = (
  data: ReviewData,
  user: ReviewUser,
  timestamp: number,
): ReviewData => ({
  ...data,
  contributors: {
    ...data.contributors,
    [getReviewUserId(user)]: {
      user,
      lastContributionAt: timestamp,
    },
  },
});

const findMentionedCollaborators = (
  mentions: readonly string[],
  collaborators?: Map<SocketId, Collaborator>,
) => {
  if (!collaborators || !mentions.length) {
    return [];
  }

  const mentionSet = new Set(mentions.map((mention) => mention.toLowerCase()));
  const users: ReviewUser[] = [];

  collaborators.forEach((collaborator, socketId) => {
    const username = collaborator.username?.trim();
    if (username && mentionSet.has(username.toLowerCase())) {
      users.push(collaboratorToReviewUser(socketId, collaborator));
    }
  });

  return users;
};

const createMentionNotifications = ({
  data,
  thread,
  comment,
  collaborators,
}: {
  data: ReviewData;
  thread: ReviewThread;
  comment: ReviewComment;
  collaborators?: Map<SocketId, Collaborator>;
}): ReviewNotification[] => {
  const mentionedUsers = findMentionedCollaborators(
    comment.mentions,
    collaborators,
  ).filter((user) => getReviewUserId(user) !== getReviewUserId(comment.author));

  return mentionedUsers
    .filter(
      (user) =>
        !data.notifications.some(
          (notification) =>
            notification.type === "mention" &&
            notification.userId === getReviewUserId(user) &&
            notification.commentId === comment.id,
        ),
    )
    .map((user) => ({
      id: createId("review-notification"),
      userId: getReviewUserId(user),
      threadId: thread.id,
      commentId: comment.id,
      elementId: thread.elementId,
      type: "mention" as const,
      actor: comment.author,
      created: comment.created,
      read: false,
    }));
};

const createReplyNotifications = ({
  data,
  thread,
  comment,
}: {
  data: ReviewData;
  thread: ReviewThread;
  comment: ReviewComment;
}): ReviewNotification[] => {
  const participants = new Map<string, ReviewUser>();
  thread.comments.forEach((threadComment) => {
    participants.set(
      getReviewUserId(threadComment.author),
      threadComment.author,
    );
  });
  participants.delete(getReviewUserId(comment.author));

  return Array.from(participants.values())
    .filter(
      (user) =>
        !data.notifications.some(
          (notification) =>
            notification.type === "reply" &&
            notification.userId === getReviewUserId(user) &&
            notification.commentId === comment.id,
        ),
    )
    .map((user) => ({
      id: createId("review-notification"),
      userId: getReviewUserId(user),
      threadId: thread.id,
      commentId: comment.id,
      elementId: thread.elementId,
      type: "reply" as const,
      actor: comment.author,
      created: comment.created,
      read: false,
    }));
};

export const addReviewComment = (
  data: ReviewData,
  input: ReviewCommentInput,
): ReviewData => {
  const created = input.created ?? now();
  const comment: ReviewComment = {
    id: createId("review-comment"),
    author: input.author,
    body: input.body,
    created,
    mentions: parseReviewMentions(input.body),
    reactions: {},
  };

  const existingThread = input.threadId
    ? data.threads.find((thread) => thread.id === input.threadId)
    : null;

  const thread: ReviewThread = existingThread
    ? {
        ...existingThread,
        comments: [...existingThread.comments, comment],
        updated: created,
      }
    : {
        id: createId("review-thread"),
        elementId: input.elementId,
        comments: [comment],
        created,
        updated: created,
        resolved: false,
      };

  const threads = existingThread
    ? data.threads.map((candidate) =>
        candidate.id === thread.id ? thread : candidate,
      )
    : [...data.threads, thread];

  const nextData = touchReviewContributor(
    {
      ...data,
      threads,
      notifications: [
        ...data.notifications,
        ...(existingThread
          ? createReplyNotifications({
              data,
              thread: existingThread,
              comment,
            })
          : []),
        ...createMentionNotifications({
          data,
          thread,
          comment,
          collaborators: input.collaborators,
        }),
      ],
    },
    input.author,
    created,
  );

  return nextData;
};

export const setReviewThreadResolved = ({
  data,
  threadId,
  resolved,
  actor,
  timestamp = now(),
}: {
  data: ReviewData;
  threadId: string;
  resolved: boolean;
  actor: ReviewUser;
  timestamp?: number;
}): ReviewData =>
  touchReviewContributor(
    {
      ...data,
      threads: data.threads.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              updated: timestamp,
              resolved,
              resolvedBy: resolved ? actor : undefined,
              resolvedAt: resolved ? timestamp : undefined,
            }
          : thread,
      ),
    },
    actor,
    timestamp,
  );

export const toggleReviewReaction = ({
  data,
  threadId,
  commentId,
  reaction,
  actor,
  timestamp = now(),
}: {
  data: ReviewData;
  threadId: string;
  commentId: string;
  reaction: ReviewReaction;
  actor: ReviewUser;
  timestamp?: number;
}): ReviewData => {
  const actorId = getReviewUserId(actor);

  return touchReviewContributor(
    {
      ...data,
      threads: data.threads.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              updated: timestamp,
              comments: thread.comments.map((comment) => {
                if (comment.id !== commentId) {
                  return comment;
                }

                const reactionUsers = new Set(
                  comment.reactions[reaction] || [],
                );
                if (reactionUsers.has(actorId)) {
                  reactionUsers.delete(actorId);
                } else {
                  reactionUsers.add(actorId);
                }

                return {
                  ...comment,
                  reactions: {
                    ...comment.reactions,
                    [reaction]: Array.from(reactionUsers),
                  },
                };
              }),
            }
          : thread,
      ),
    },
    actor,
    timestamp,
  );
};

export const markReviewNotificationRead = (
  data: ReviewData,
  notificationId: string,
): ReviewData => ({
  ...data,
  notifications: data.notifications.map((notification) =>
    notification.id === notificationId
      ? { ...notification, read: true }
      : notification,
  ),
});

export const getReviewThreadsForElement = (
  data: ReviewData,
  elementId: string,
) => data.threads.filter((thread) => thread.elementId === elementId);

export const getUnresolvedReviewThreads = (data: ReviewData) =>
  data.threads.filter((thread) => !thread.resolved);

export const sortByReviewContribution = <
  T extends { id?: string; socketId?: string },
>(
  users: readonly T[],
  contributors?: Record<string, ContributorActivity>,
): T[] =>
  [...users].sort((a, b) => {
    const aActivity = contributors?.[a.id || a.socketId || ""];
    const bActivity = contributors?.[b.id || b.socketId || ""];

    return (
      (bActivity?.lastContributionAt ?? 0) -
      (aActivity?.lastContributionAt ?? 0)
    );
  });

export const setReviewCurrentUser = (
  data: ReviewData,
  user: ReviewUser | null,
): ReviewData => ({
  ...data,
  currentUser: user,
});

export const getElementReviewAttribution = (
  element: Pick<ExcalidrawElement, "customData">,
): ElementReviewAttribution | null => {
  const attribution = element.customData?.review?.attribution;
  if (
    !attribution ||
    !attribution.createdBy ||
    !attribution.lastEditedBy ||
    typeof attribution.createdAt !== "number" ||
    typeof attribution.lastEditedAt !== "number"
  ) {
    return null;
  }

  return attribution;
};

export const withElementReviewAttribution = <
  TElement extends ExcalidrawElement,
>(
  element: TElement,
  user: ReviewUser,
  timestamp = now(),
): TElement => {
  const existingAttribution = getElementReviewAttribution(element);

  return {
    ...element,
    customData: {
      ...element.customData,
      review: {
        ...element.customData?.review,
        attribution: {
          createdBy: existingAttribution?.createdBy ?? user,
          createdAt: existingAttribution?.createdAt ?? timestamp,
          lastEditedBy: user,
          lastEditedAt: timestamp,
        },
      },
    },
  };
};
