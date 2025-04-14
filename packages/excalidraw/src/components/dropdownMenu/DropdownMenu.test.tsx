import { KEYS } from "@excalidraw/common";

import { Keyboard } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  render,
  waitFor,
  getByTestId,
  fireEvent,
} from "@excalidraw/excalidraw/tests/test-utils";

import { Excalidraw } from "../../index";

describe("Test <DropdownMenu/>", () => {
  it("should", async () => {
    const { container } = await render(<Excalidraw />);

    expect(window.h.state.openMenu).toBe(null);

    fireEvent.click(getByTestId(container, "main-menu-trigger"));
    expect(window.h.state.openMenu).toBe("canvas");

    await waitFor(() => {
      Keyboard.keyDown(KEYS.ESCAPE);
      expect(window.h.state.openMenu).toBe(null);
    });
  });
});
