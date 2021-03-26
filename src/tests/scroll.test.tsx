import React from "react";
import { render, waitFor } from "./test-utils";
import Excalidraw from "../packages/excalidraw/index";
import { API } from "./helpers/api";

const { h } = window;

describe("appState", () => {
  it("scroll-to-content on init works with non-zero offsets", async () => {
    const WIDTH = 600;
    const HEIGHT = 700;
    const OFFSET_LEFT = 200;
    const OFFSET_TOP = 100;

    const ELEM_WIDTH = 100;
    const ELEM_HEIGHT = 60;

    const originalGetBoundingClientRect =
      global.window.HTMLDivElement.prototype.getBoundingClientRect;
    // override getBoundingClientRect as by default it will always return all values as 0 even if customized in html
    global.window.HTMLDivElement.prototype.getBoundingClientRect = () => ({
      top: OFFSET_TOP,
      left: OFFSET_LEFT,
      bottom: 10,
      right: 10,
      width: 100,
      x: 10,
      y: 20,
      height: 100,
      toJSON: () => {},
    });

    await render(
      <div>
        <Excalidraw
          width={WIDTH}
          height={HEIGHT}
          initialData={{
            elements: [
              API.createElement({
                type: "rectangle",
                id: "A",
                width: ELEM_WIDTH,
                height: ELEM_HEIGHT,
              }),
            ],
            scrollToContent: true,
          }}
        />
      </div>,
    );
    await waitFor(() => {
      expect(h.state.width).toBe(WIDTH);
      expect(h.state.height).toBe(HEIGHT);
      expect(h.state.offsetLeft).toBe(OFFSET_LEFT);
      expect(h.state.offsetTop).toBe(OFFSET_TOP);

      // assert scroll is in center
      expect(h.state.scrollX).toBe(WIDTH / 2 - ELEM_WIDTH / 2);
      expect(h.state.scrollY).toBe(HEIGHT / 2 - ELEM_HEIGHT / 2);
    });
    global.window.HTMLDivElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });
});
