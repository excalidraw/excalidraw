import { vi } from "vitest";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { act, fireEvent, render, waitFor } from "../tests/test-utils";

import type { Collaborator, SocketId } from "../types";

const createCollaborators = (count: number) => {
  const collaborators = new Map<SocketId, Collaborator>();

  for (let index = 0; index < count; index++) {
    const socketId = `socket-${index}` as SocketId;
    collaborators.set(socketId, {
      socketId,
      username: `Collaborator ${index}`,
    });
  }

  return collaborators;
};

describe("UserList", () => {
  it("renders the collaborators popover without missing key warnings", async () => {
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    const consoleError = vi.spyOn(console, "error");

    try {
      await render(<Excalidraw />);

      API.updateScene({
        collaborators: createCollaborators(8),
      });

      const moreButton = await waitFor(() => {
        const button =
          document.querySelector<HTMLButtonElement>(".UserList__more");
        expect(button).not.toBeNull();
        return button!;
      });

      await act(async () => {
        fireEvent.click(moreButton);
      });

      await waitFor(() => {
        expect(
          document.querySelector(".UserList__collaborators .hint"),
        ).not.toBeNull();
        expect(
          document.querySelectorAll(".UserList__collaborator").length,
        ).toBe(8);
      });

      expect(
        consoleError.mock.calls.some(([message]) =>
          String(message).includes(
            'Each child in a list should have a unique "key" prop',
          ),
        ),
      ).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });
});
