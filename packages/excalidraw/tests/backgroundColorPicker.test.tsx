import { DEFAULT_ELEMENT_BACKGROUND_PICKS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { render } from "./test-utils";

const { h } = window;

const RED = DEFAULT_ELEMENT_BACKGROUND_PICKS[1];

const getActiveBackgroundPick = () =>
  document
    .querySelector('.properties-trigger[aria-label="Background"]')
    ?.closest(".color-picker-container")
    ?.querySelector<HTMLElement>(
      ".color-picker__top-picks .color-picker__button.active",
    )?.dataset.testid;

describe("background color picker", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("ignores elements without a background when computing the common color", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      backgroundColor: RED,
    });
    const ellipse = API.createElement({
      type: "ellipse",
      backgroundColor: RED,
    });
    const text = API.createElement({
      type: "text",
      backgroundColor: "transparent",
    });
    const arrow = API.createElement({
      type: "arrow",
      backgroundColor: "transparent",
    });

    API.setElements([rectangle, ellipse, text, arrow]);
    API.setSelectedElements([rectangle, ellipse, text, arrow]);

    expect(getActiveBackgroundPick()).toBe(`color-top-pick-${RED}`);
  });

  it("still shows no common color when shapes have different backgrounds", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      backgroundColor: RED,
    });
    const ellipse = API.createElement({
      type: "ellipse",
      backgroundColor: "transparent",
    });

    API.setElements([rectangle, ellipse]);
    API.setSelectedElements([rectangle, ellipse]);

    expect(h.state.selectedElementIds).toEqual({
      [rectangle.id]: true,
      [ellipse.id]: true,
    });
    expect(getActiveBackgroundPick()).toBeUndefined();
  });
});
