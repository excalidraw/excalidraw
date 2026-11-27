import { Excalidraw } from "../index";

import { act, fireEvent, render } from "./test-utils";

import type { Collaborator, SocketId } from "../types";

describe("hide collaborator cursors", () => {
  const { h } = window;

  it("only shows the toolbar toggle during collaboration", async () => {
    const { queryByTestId } = await render(<Excalidraw />);

    expect(queryByTestId("toolbar-HideCollaborators")).not.toBeInTheDocument();
  });

  it("toggles cursor visibility without removing collaborator data", async () => {
    const { getByTestId } = await render(<Excalidraw isCollaborating />);
    const socketId = "remote-user" as SocketId;
    const collaborators = new Map<SocketId, Collaborator>([
      [
        socketId,
        {
          username: "Remote user",
          pointer: { x: 100, y: 100, tool: "pointer" },
          selectedElementIds: { rectangle: true },
        },
      ],
    ]);

    act(() => {
      h.app.updateScene({ collaborators });
    });

    const toggle = getByTestId("toolbar-HideCollaborators");
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle).toHaveAccessibleName("Hide collaborators' cursors");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(h.state.collaboratorsCursorsHidden).toBe(false);

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(h.state.collaboratorsCursorsHidden).toBe(true);
    expect(h.state.collaborators).toEqual(collaborators);

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(h.state.collaboratorsCursorsHidden).toBe(false);
    expect(h.state.collaborators).toEqual(collaborators);
  });
});
