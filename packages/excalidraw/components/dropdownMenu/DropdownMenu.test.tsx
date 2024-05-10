import { Excalidraw } from "../../index";
import { KEYS } from "../../keys";
import { Keyboard } from "../../tests/helpers/ui";
import { render, waitFor, getByTestId } from "../../tests/test-utils";

describe("Test <DropdownMenu/>", () => {
  it("should", async () => {
    const { container } = await render(<Excalidraw />);

    expect(window.h.state.openMenu).toBe(null);

    getByTestId(container, "main-menu-trigger").click();
    expect(window.h.state.openMenu).toBe("canvas");

    await waitFor(() => {
      Keyboard.keyDown(KEYS.ESCAPE);
      expect(window.h.state.openMenu).toBe(null);
    });
  });
});
