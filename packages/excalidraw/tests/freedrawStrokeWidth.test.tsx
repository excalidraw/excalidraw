import { getNormalizedZoom } from "../scene";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import { act, queryByTestId, render } from "./test-utils";

const { h } = window;

const strokeAt = (zoom: number) => {
  API.setAppState({ zoom: { value: getNormalizedZoom(zoom) } });
  return UI.createElement("freedraw", { x: 0, y: 0, width: 10, height: 10 })
    .strokeWidth;
};

const strokeWidthPicker = () =>
  queryByTestId(document.body, "strokeWidth-thin");

describe("freedrawStrokeWidth", () => {
  afterEach(async () => {
    await act(async () => {});
  });

  it("draws each stroke at the same width on screen in screen units", async () => {
    await render(
      <Excalidraw authoringUnits="screen" freedrawStrokeWidth={3} />,
    );

    expect(strokeAt(1)).toBe(3);
    expect(strokeAt(100)).toBeCloseTo(0.03, 12);
    expect(strokeAt(10_000)).toBeCloseTo(0.0003, 12);
  });

  it("is a scene width in scene units", async () => {
    await render(<Excalidraw freedrawStrokeWidth={3} />);

    expect(strokeAt(1)).toBe(3);
    expect(strokeAt(100)).toBe(3);
  });

  it("applies a new width to the next stroke", async () => {
    const { rerender } = await render(
      <Excalidraw authoringUnits="screen" freedrawStrokeWidth={3} />,
    );
    expect(strokeAt(100)).toBeCloseTo(0.03, 12);

    rerender(<Excalidraw authoringUnits="screen" freedrawStrokeWidth={6} />);

    expect(strokeAt(100)).toBeCloseTo(0.06, 12);
    expect(strokeAt(1)).toBe(6);
  });

  it("hides the stroke width picker while the freedraw tool is out", async () => {
    await render(<Excalidraw freedrawStrokeWidth={3} />);

    UI.clickTool("freedraw");
    expect(strokeWidthPicker()).toBeNull();

    UI.clickTool("rectangle");
    expect(strokeWidthPicker()).not.toBeNull();
  });

  it("keeps the named widths without it", async () => {
    await render(<Excalidraw />);

    UI.clickTool("freedraw");
    expect(strokeWidthPicker()).not.toBeNull();
    expect(strokeAt(1)).toBe(0.5);
    expect(strokeAt(100)).toBe(0.5);
    expect(h.state.currentItemStrokeWidthKey).toBe("medium");
  });
});
