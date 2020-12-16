import React from "react";
import { render, waitFor } from "./test-utils";
import Excalidraw from "../packages/excalidraw/index";
import { API } from "./helpers/api";

const { h } = window;

describe("appState", () => {
  it("scroll-to-center on init works with non-zero offsets", async () => {
    const WIDTH = 600;
    const HEIGHT = 700;
    const OFFSET_LEFT = 200;
    const OFFSET_TOP = 100;

    const ELEM_WIDTH = 100;
    const ELEM_HEIGHT = 60;

    await render(
      <Excalidraw
        width={WIDTH}
        height={HEIGHT}
        offsetLeft={OFFSET_LEFT}
        offsetTop={OFFSET_TOP}
        initialData={{
          elements: [
            API.createElement({
              type: "rectangle",
              id: "A",
              width: ELEM_WIDTH,
              height: ELEM_HEIGHT,
            }),
          ],
        }}
      />,
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
  });
});
