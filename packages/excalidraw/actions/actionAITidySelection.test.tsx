import { waitFor } from "@testing-library/react";

import { AITidySelectionPlugin, Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { render } from "../tests/test-utils";

import { actionAITidySelection } from "./actionAITidySelection";

describe("actionAITidySelection", () => {
  it("repositions selected elements from plugin response", async () => {
    const tidy = vi.fn(async ({ selectedElements }) => ({
      positions: selectedElements.map((element: (typeof selectedElements)[number]) => ({
        id: element.id,
        x: element.x + 10,
        y: element.y + 20,
      })),
    }));

    await render(
      <Excalidraw>
        <AITidySelectionPlugin tidy={tidy} />
      </Excalidraw>,
    );

    const first = API.createElement({
      id: "rect-a",
      type: "rectangle",
      x: 100,
      y: 100,
      width: 120,
      height: 80,
    });
    const second = API.createElement({
      id: "rect-b",
      type: "rectangle",
      x: 320,
      y: 120,
      width: 120,
      height: 80,
    });

    API.setElements([first, second]);
    API.setSelectedElements([first, second]);
    API.executeAction(actionAITidySelection);

    await waitFor(() => {
      expect(API.getElement(first).x).toBe(110);
      expect(API.getElement(first).y).toBe(120);
      expect(API.getElement(second).x).toBe(330);
      expect(API.getElement(second).y).toBe(140);
    });

    expect(tidy).toHaveBeenCalledTimes(1);
  });
});
