import { describe, expect, it } from "vitest";

import { serializeAsJSON } from "../data/json";
import { restoreAppState } from "../data/restore";
import {
  addReviewComment,
  getDefaultReviewData,
  getElementReviewAttribution,
  getReviewThreadsForElement,
  markReviewNotificationRead,
  setReviewThreadResolved,
  sortByReviewContribution,
  toggleReviewReaction,
  touchReviewContributor,
  withElementReviewAttribution,
} from "../review";

import { API } from "./helpers/api";

import type { ReviewUser } from "../review";

import type { Collaborator, SocketId } from "../types";

const user = (id: string, username: string): ReviewUser => ({ id, username });

const collaborators = new Map<SocketId, Collaborator>([
  ["socket-alice" as SocketId, { id: "alice", username: "Alice" }],
  ["socket-bob" as SocketId, { id: "bob", username: "Bob" }],
]);

describe("review data", () => {
  it("creates element-anchored threads and dedupes mention notifications", () => {
    const review = addReviewComment(getDefaultReviewData(), {
      elementId: "element-a",
      author: user("me", "Me"),
      body: "Can @Alice and @alice review this with @missing?",
      collaborators,
      created: 100,
    });

    expect(review.threads).toHaveLength(1);
    expect(review.threads[0].elementId).toBe("element-a");
    expect(review.threads[0].comments[0].mentions).toEqual([
      "alice",
      "missing",
    ]);
    expect(review.notifications).toMatchObject([
      {
        userId: "alice",
        elementId: "element-a",
        type: "mention",
        read: false,
      },
    ]);
  });

  it("creates reply notifications for existing thread participants", () => {
    const originalAuthor = user("alice", "Alice");
    const replyAuthor = user("bob", "Bob");
    const first = addReviewComment(getDefaultReviewData(), {
      elementId: "element-a",
      author: originalAuthor,
      body: "Initial note",
      created: 100,
    });

    const threadId = first.threads[0].id;
    const second = addReviewComment(first, {
      threadId,
      elementId: "element-a",
      author: replyAuthor,
      body: "Replying to @Alice",
      collaborators,
      created: 200,
    });

    expect(second.threads[0].comments).toHaveLength(2);
    expect(second.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "alice",
          type: "reply",
          read: false,
        }),
        expect.objectContaining({
          userId: "alice",
          type: "mention",
          read: false,
        }),
      ]),
    );
  });

  it("toggles reactions and read state", () => {
    const actor = user("alice", "Alice");
    const first = addReviewComment(getDefaultReviewData(), {
      elementId: "element-a",
      author: user("bob", "Bob"),
      body: "@Alice please review",
      collaborators,
      created: 100,
    });
    const thread = first.threads[0];
    const comment = thread.comments[0];

    const reacted = toggleReviewReaction({
      data: first,
      threadId: thread.id,
      commentId: comment.id,
      reaction: "eyes",
      actor,
      timestamp: 200,
    });
    expect(reacted.threads[0].comments[0].reactions.eyes).toEqual(["alice"]);

    const unreacted = toggleReviewReaction({
      data: reacted,
      threadId: thread.id,
      commentId: comment.id,
      reaction: "eyes",
      actor,
      timestamp: 300,
    });
    expect(unreacted.threads[0].comments[0].reactions.eyes).toEqual([]);

    const read = markReviewNotificationRead(first, first.notifications[0].id);
    expect(read.notifications[0].read).toBe(true);
  });

  it("resolves, reopens, and sorts collaborators by contribution time", () => {
    const alice = user("alice", "Alice");
    const bob = user("bob", "Bob");
    const first = addReviewComment(getDefaultReviewData(), {
      elementId: "element-a",
      author: alice,
      body: "Initial note",
      created: 100,
    });

    const resolved = setReviewThreadResolved({
      data: first,
      threadId: first.threads[0].id,
      resolved: true,
      actor: bob,
      timestamp: 200,
    });
    expect(resolved.threads[0]).toMatchObject({
      resolved: true,
      resolvedAt: 200,
      resolvedBy: bob,
    });

    const reopened = setReviewThreadResolved({
      data: resolved,
      threadId: first.threads[0].id,
      resolved: false,
      actor: alice,
      timestamp: 300,
    });
    expect(reopened.threads[0].resolved).toBe(false);

    const contributed = touchReviewContributor(reopened, bob, 400);
    expect(
      sortByReviewContribution(
        [
          { id: "alice", socketId: "socket-alice" },
          { id: "bob", socketId: "socket-bob" },
        ],
        contributed.contributors,
      ).map((collaborator) => collaborator.id),
    ).toEqual(["bob", "alice"]);
  });

  it("stores attribution in element custom data", () => {
    const element = API.createElement({
      id: "element-a",
      type: "rectangle",
    });
    const created = withElementReviewAttribution(
      element,
      user("alice", "Alice"),
      100,
    );
    const edited = withElementReviewAttribution(
      created,
      user("bob", "Bob"),
      200,
    );

    expect(getElementReviewAttribution(edited)).toMatchObject({
      createdBy: { id: "alice", username: "Alice" },
      createdAt: 100,
      lastEditedBy: { id: "bob", username: "Bob" },
      lastEditedAt: 200,
    });
  });

  it("survives scene serialization and restoration", () => {
    const review = addReviewComment(getDefaultReviewData(), {
      elementId: "element-a",
      author: user("alice", "Alice"),
      body: "Persist me",
      created: 100,
    });
    const serialized = serializeAsJSON([], { review }, {}, "local");
    const parsed = JSON.parse(serialized);
    const restored = restoreAppState(parsed.appState, null);

    expect(restored.review.threads[0]).toMatchObject({
      elementId: "element-a",
      resolved: false,
    });
    expect(restored.review.threads[0].comments[0]).toMatchObject({
      body: "Persist me",
      author: { id: "alice", username: "Alice" },
    });
  });
  it("returns only threads anchored to the selected element", () => {
    const first = addReviewComment(getDefaultReviewData(), {
      elementId: "element-a",
      author: user("alice", "Alice"),
      body: "Thread for A",
      created: 100,
    });
    const second = addReviewComment(first, {
      elementId: "element-b",
      author: user("bob", "Bob"),
      body: "Thread for B",
      created: 200,
    });
    const third = addReviewComment(second, {
      elementId: "element-a",
      author: user("me", "Me"),
      body: "Another thread for A",
      created: 300,
    });

    expect(
      getReviewThreadsForElement(third, "element-a").map(
        (thread) => thread.comments[0].body,
      ),
    ).toEqual(["Thread for A", "Another thread for A"]);
    expect(
      getReviewThreadsForElement(third, "element-b").map(
        (thread) => thread.comments[0].body,
      ),
    ).toEqual(["Thread for B"]);
  });
});
