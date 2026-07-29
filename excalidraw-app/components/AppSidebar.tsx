import React from "react";

import {
  DefaultSidebar,
  REVIEW_REACTIONS,
  Sidebar,
  THEME,
  getReviewUserId,
  useExcalidrawAPI,
} from "@excalidraw/excalidraw";
import {
  messageCircleIcon,
  presentationIcon,
} from "@excalidraw/excalidraw/components/icons";
import { LinkButton } from "@excalidraw/excalidraw/components/LinkButton";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";

import type {
  ReviewComment,
  ReviewReaction,
  ReviewThread,
  ReviewUser,
} from "@excalidraw/excalidraw";

import "./AppSidebar.scss";

type SidebarPromoCopyProps = {
  text: string;
};

const SidebarPromoCopy = (props: SidebarPromoCopyProps) => {
  return (
    <div className="app-sidebar-promo-copy">
      <div className="app-sidebar-promo-illustration" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 300 250"
          className="app-sidebar-promo-heart"
        >
          <path
            d="M 145 75
           C 110 35, 60 55, 65 120
           C 70 180, 140 190, 215 200
           C 225 180, 260 110, 235 55
           C 210 -5, 140 20, 160 105"
            fill="none"
            stroke="#D06B64"
            strokeWidth="16"
            strokeLinecap="round"
          />
        </svg>

        <div className="app-sidebar-promo-trial-note excalifont">
          14 days of
          <br />
          free trial
        </div>
        <svg
          className="app-sidebar-promo-trial-arrow"
          viewBox="0 0 72 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 6C23 1 50 8 48 32"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M42 26L48 32L54 26"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="app-sidebar-promo-text">{props.text}</div>
    </div>
  );
};

const REVIEW_REACTION_LABELS: Record<ReviewReaction, string> = {
  thumbsUp: "👍",
  check: "✅",
  eyes: "👀",
};

const getCurrentReviewUser = (
  currentUser: ReviewUser | null | undefined,
): ReviewUser =>
  currentUser || {
    id: "local-review-user",
    username: "You",
  };

const CommentReactions = ({
  comment,
  onToggle,
  user,
}: {
  comment: ReviewComment;
  onToggle: (reaction: ReviewReaction) => void;
  user: ReviewUser;
}) => {
  const userId = getReviewUserId(user);

  return (
    <div className="review-sidebar-reactions">
      {REVIEW_REACTIONS.map((reaction) => {
        const users = comment.reactions[reaction] || [];
        const pressed = users.includes(userId);

        return (
          <button
            aria-pressed={pressed}
            className="review-sidebar-reaction"
            data-testid={`review-reaction-${reaction}`}
            key={reaction}
            onClick={() => onToggle(reaction)}
            type="button"
          >
            <span>{REVIEW_REACTION_LABELS[reaction]}</span>
            <span>{users.length}</span>
          </button>
        );
      })}
    </div>
  );
};

const ReviewThreadItem = ({
  deleted,
  thread,
  user,
}: {
  deleted: boolean;
  thread: ReviewThread;
  user: ReviewUser;
}) => {
  const api = useExcalidrawAPI();
  const [reply, setReply] = React.useState("");

  if (!api) {
    return null;
  }

  return (
    <article className="review-sidebar-thread" data-testid="review-thread">
      <div className="review-sidebar-thread-header">
        <div>
          <div className="review-sidebar-thread-title">
            Element {deleted ? "deleted" : thread.elementId.slice(0, 8)}
          </div>
          <div className="review-sidebar-thread-meta">
            {thread.resolved ? "Resolved" : "Unresolved"}
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            api.setReviewThreadResolved(thread.id, !thread.resolved, user)
          }
        >
          {thread.resolved ? "Reopen" : "Resolve"}
        </button>
      </div>

      <div className="review-sidebar-comments">
        {thread.comments.map((comment) => (
          <div className="review-sidebar-comment" key={comment.id}>
            <div className="review-sidebar-comment-meta">
              {comment.author.username}
            </div>
            <div className="review-sidebar-comment-body">{comment.body}</div>
            <CommentReactions
              comment={comment}
              user={user}
              onToggle={(reaction) =>
                api.toggleReviewReaction(thread.id, comment.id, reaction, user)
              }
            />
          </div>
        ))}
      </div>

      <form
        className="review-sidebar-reply"
        onSubmit={(event) => {
          event.preventDefault();
          const body = reply.trim();
          if (!body) {
            return;
          }
          api.addReviewComment({
            threadId: thread.id,
            elementId: thread.elementId,
            body,
            author: user,
          });
          setReply("");
        }}
      >
        <input
          aria-label="Reply"
          onChange={(event) => setReply(event.target.value)}
          placeholder="Reply..."
          value={reply}
        />
        <button type="submit">Send</button>
      </form>
    </article>
  );
};

const ReviewSidebar = () => {
  const appState = useUIAppState();
  const api = useExcalidrawAPI();
  const [comment, setComment] = React.useState("");

  const selectedElementIds = Object.keys(appState.selectedElementIds);
  const selectedElementId =
    selectedElementIds.length === 1 ? selectedElementIds[0] : null;
  const user = getCurrentReviewUser(appState.review.currentUser);

  if (!api) {
    return null;
  }

  const sceneElementIds = new Set(
    api
      .getSceneElementsIncludingDeleted()
      .filter((element) => !element.isDeleted)
      .map((element) => element.id),
  );
  const unreadNotifications = appState.review.notifications.filter(
    (notification) => !notification.read,
  );
  const unresolvedThreads = appState.review.threads.filter(
    (thread) => !thread.resolved,
  );

  return (
    <div className="review-sidebar" data-testid="review-sidebar">
      <form
        className="review-sidebar-composer"
        onSubmit={(event) => {
          event.preventDefault();
          const body = comment.trim();
          if (!selectedElementId || !body) {
            return;
          }
          api.addReviewComment({
            elementId: selectedElementId,
            body,
            author: user,
          });
          setComment("");
        }}
      >
        <label htmlFor="review-comment-input">Comment on selection</label>
        <textarea
          disabled={!selectedElementId}
          id="review-comment-input"
          onChange={(event) => setComment(event.target.value)}
          placeholder={
            selectedElementId
              ? "Leave a comment. Use @name to mention collaborators."
              : "Select one element to comment"
          }
          value={comment}
        />
        <button disabled={!selectedElementId || !comment.trim()} type="submit">
          Add comment
        </button>
      </form>

      <section className="review-sidebar-section">
        <h3>Inbox</h3>
        {unreadNotifications.length ? (
          unreadNotifications.map((notification) => (
            <div
              className="review-sidebar-notification"
              data-testid="review-notification"
              key={notification.id}
            >
              <span>
                {notification.actor.username}{" "}
                {notification.type === "mention" ? "mentioned you" : "replied"}
              </span>
              <button
                type="button"
                onClick={() => api.markReviewNotificationRead(notification.id)}
              >
                Mark read
              </button>
            </div>
          ))
        ) : (
          <p className="review-sidebar-empty">No unread notifications</p>
        )}
      </section>

      <section className="review-sidebar-section">
        <h3>Unresolved</h3>
        {unresolvedThreads.length ? (
          unresolvedThreads.map((thread) => (
            <ReviewThreadItem
              deleted={!sceneElementIds.has(thread.elementId)}
              key={thread.id}
              thread={thread}
              user={user}
            />
          ))
        ) : (
          <p className="review-sidebar-empty">No unresolved threads</p>
        )}
      </section>

      {appState.review.threads.some((thread) => thread.resolved) && (
        <section className="review-sidebar-section">
          <h3>Resolved</h3>
          {appState.review.threads
            .filter((thread) => thread.resolved)
            .map((thread) => (
              <ReviewThreadItem
                deleted={!sceneElementIds.has(thread.elementId)}
                key={thread.id}
                thread={thread}
                user={user}
              />
            ))}
        </section>
      )}
    </div>
  );
};

export const AppSidebar = () => {
  const { theme, openSidebar } = useUIAppState();

  return (
    <DefaultSidebar>
      <DefaultSidebar.TabTriggers>
        <Sidebar.TabTrigger
          tab="comments"
          style={{ opacity: openSidebar?.tab === "comments" ? 1 : 0.4 }}
        >
          {messageCircleIcon}
        </Sidebar.TabTrigger>
        <Sidebar.TabTrigger
          tab="presentation"
          style={{ opacity: openSidebar?.tab === "presentation" ? 1 : 0.4 }}
        >
          {presentationIcon}
        </Sidebar.TabTrigger>
      </DefaultSidebar.TabTriggers>
      <Sidebar.Tab tab="comments">
        <ReviewSidebar />
      </Sidebar.Tab>
      <Sidebar.Tab tab="presentation" className="px-3">
        <div className="app-sidebar-promo-container">
          <div
            className="app-sidebar-promo-image"
            style={{
              ["--image-source" as any]: `url(/sidebar-presentation-promo-${
                theme === THEME.DARK ? "dark" : "light"
              }.jpg)`,
              opacity: 0.7,
            }}
          />
          <SidebarPromoCopy text="Create presentation with Excalidraw+" />
          <LinkButton
            href={`${
              import.meta.env.VITE_APP_PLUS_LP
            }/plus?utm_source=excalidraw&utm_medium=app&utm_content=presentations_promo#excalidraw-redirect`}
          >
            Sign up now
          </LinkButton>
        </div>
      </Sidebar.Tab>
    </DefaultSidebar>
  );
};
