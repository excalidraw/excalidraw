import React from "react";

import { Excalidraw } from "../index";
import {
  act,
  fireEvent,
  getByText,
  render,
  waitFor,
} from "../tests/test-utils";

import type { Collaborator, SocketId } from "../types";

const socketId = (id: string) => id as SocketId;

describe("UserList", () => {
  it("retains the local dropdown when the same account has multiple clients", async () => {
    const { container } = await render(
      <Excalidraw
        currentUserControls={<button type="button">Spotlight me</button>}
      />,
    );
    const currentSocketId = socketId("current");
    const otherSocketId = socketId("other");

    act(() => {
      window.h.app.updateScene({
        collaborators: new Map<SocketId, Collaborator>([
          [
            otherSocketId,
            {
              id: "user",
              socketId: otherSocketId,
              username: "Ada",
              isCurrentUser: false,
            },
          ],
          [
            currentSocketId,
            {
              id: "user",
              socketId: currentSocketId,
              username: "Ada",
              isCurrentUser: true,
            },
          ],
        ]),
      });
    });

    await waitFor(() => {
      expect(container.querySelectorAll(".UserList__pill")).toHaveLength(1);
    });

    const currentUserPill =
      container.querySelector<HTMLElement>(".UserList__pill");
    expect(currentUserPill).not.toBeNull();

    // Radix Popover measures its content when opened.
    (global as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    fireEvent.click(currentUserPill!);

    await waitFor(() => {
      const dropdown = document.querySelector(".UserList__collaborators");
      const dropdownCollaborators = dropdown?.querySelectorAll(
        ".UserList__collaborator",
      );
      expect(dropdownCollaborators).toHaveLength(2);
      expect(
        dropdown?.querySelectorAll(".UserList__collaborator.is-current-user"),
      ).toHaveLength(1);
      expect(getByText(document.body, "Spotlight me")).toBeVisible();
    });
  });
});
