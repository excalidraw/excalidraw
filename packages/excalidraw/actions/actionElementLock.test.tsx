import React from "react";
import { Excalidraw } from "../index";
import { queryByTestId, fireEvent } from "@testing-library/react";
import { render } from "../tests/test-utils";
import { Pointer, UI } from "../tests/helpers/ui";
import { API } from "../tests/helpers/api";

const { h } = window;
const mouse = new Pointer("mouse");

describe("element locking", () => {
  it("should not show unlockAllElements action in contextMenu if no elements locked", async () => {
    await render(<Excalidraw />);

    mouse.rightClickAt(0, 0);

    const item = queryByTestId(UI.queryContextMenu()!, "unlockAllElements");
    expect(item).toBe(null);
  });

  it("should unlock all elements and select them when using unlockAllElements action in contextMenu", async () => {
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

    expect(Object.keys(h.state.selectedElementIds).length).toBe(0);
    expect(h.elements.map((el) => el.locked)).toEqual([true, true, false]);

    const item = queryByTestId(UI.queryContextMenu()!, "unlockAllElements");
    expect(item).not.toBe(null);

    fireEvent.click(item!.querySelector("button")!);

    expect(h.elements.map((el) => el.locked)).toEqual([false, false, false]);
    // should select the unlocked elements
    expect(h.state.selectedElementIds).toEqual({
      [h.elements[0].id]: true,
      [h.elements[1].id]: true,
    });
  });
});
