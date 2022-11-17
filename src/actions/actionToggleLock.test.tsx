// import { fireEvent, GlobalTestState, render } from "../test-utils";
import { Excalidraw } from "../packages/excalidraw/index";
import { queryByTestId, fireEvent } from "@testing-library/react";
import { render } from "../tests/test-utils";
import { Pointer, UI } from "../tests/helpers/ui";
import { API } from "../tests/helpers/api";

const { h } = window;
const mouse = new Pointer("mouse");

describe("element locking", () => {
  it("should not show unlockAllCanvasElements action in contextMenu if no elements locked", async () => {
    await render(<Excalidraw />);

    mouse.rightClickAt(0, 0);

    const item = queryByTestId(
      UI.queryContextMenu()!,
      "unlockAllCanvasElements",
    );
    expect(item).toBe(null);
  });

  it("should unlock all elements when using unlockAllCanvasElements action in contextMenu", async () => {
    await render(
      <Excalidraw
        initialData={{
          elements: [
            API.createElement({
              x: 100,
              y: 100,
              width: 100,
              height: 100,
              locked: true,
            }),
            API.createElement({
              x: 100,
              y: 100,
              width: 100,
              height: 100,
              locked: true,
            }),
            API.createElement({
              x: 100,
              y: 100,
              width: 100,
              height: 100,
              locked: false,
            }),
          ],
        }}
      />,
    );

    mouse.rightClickAt(0, 0);

    expect(h.elements.map((el) => el.locked)).toEqual([true, true, false]);

    const item = queryByTestId(
      UI.queryContextMenu()!,
      "unlockAllCanvasElements",
    );
    expect(item).not.toBe(null);

    fireEvent.click(item!.querySelector("button")!);

    expect(h.elements.map((el) => el.locked)).toEqual([false, false, false]);
  });
});
