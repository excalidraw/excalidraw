import { pointFrom } from "@excalidraw/math";
import { getArrowFlowPath, normalizeArrowFlow } from "@excalidraw/element";

import type { ExcalidrawArrowElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { restoreElements } from "../data/restore";
import { API } from "../tests/helpers/api";
import { act, render } from "../tests/test-utils";

import { actionChangeArrowFlow } from "./actionArrowFlow";

import type { ArrowFlowUpdate } from "./actionArrowFlow";

const { h } = window;

const setFlow = (value: ArrowFlowUpdate) =>
  act(() => {
    h.app.actionManager.executeAction(actionChangeArrowFlow, "ui", value);
  });

const flowOf = (el: { id: string }) =>
  (API.getElement(el as ExcalidrawArrowElement) as ExcalidrawArrowElement).flow;

describe("arrow flow", () => {
  it("accepts only valid flows", () => {
    expect(normalizeArrowFlow(null)).toBe(null);
    expect(normalizeArrowFlow({ direction: "sideways" })).toBe(null);
    expect(normalizeArrowFlow({ direction: "both" })).toEqual({
      direction: "both",
      speed: "normal",
    });
    expect(
      normalizeArrowFlow({ direction: "backward", speed: "fast" }),
    ).toEqual({ direction: "backward", speed: "fast" });
  });

  it("follows a round arrow through its points, and a sharp one in straight lines", () => {
    const base = API.createElement({
      type: "arrow",
      x: 10,
      y: 10,
      points: [pointFrom(0, 0), pointFrom(50, 50), pointFrom(100, 0)],
    }) as ExcalidrawArrowElement;

    expect(getArrowFlowPath({ ...base, roundness: null })).toBe(
      "M10 10 L60 60 L110 10",
    );
    const curved = getArrowFlowPath({ ...base, roundness: { type: 2 } });
    expect(curved.startsWith("M10 10 C")).toBe(true);
    expect(curved.endsWith(" 110 10")).toBe(true);
  });

  it("is kept when a scene is restored, and dropped when invalid", () => {
    const arrow = API.createElement({ type: "arrow" });
    const [kept, dropped, plain] = restoreElements(
      [
        { ...arrow, id: "a", flow: { direction: "both", speed: "slow" } },
        { ...arrow, id: "b", flow: { direction: "up" } },
        { ...arrow, id: "c" },
      ] as ExcalidrawArrowElement[],
      null,
    ) as ExcalidrawArrowElement[];

    expect(kept.flow).toEqual({ direction: "both", speed: "slow" });
    expect(dropped.flow).toBe(null);
    expect("flow" in plain).toBe(false);
  });

  describe("in the editor", () => {
    beforeEach(async () => {
      await render(<Excalidraw />);
    });

    it("sets, changes and clears the flow of selected arrows", () => {
      const arrow = API.createElement({ type: "arrow" });
      const rect = API.createElement({ type: "rectangle" });
      API.setElements([arrow, rect]);
      API.setSelectedElements([arrow, rect]);

      setFlow({ direction: "forward" });
      expect(flowOf(arrow)).toEqual({ direction: "forward", speed: "normal" });
      expect("flow" in API.getElement(rect)).toBe(false);

      setFlow({ speed: "fast" });
      expect(flowOf(arrow)).toEqual({ direction: "forward", speed: "fast" });

      setFlow({ direction: "both" });
      expect(flowOf(arrow)).toEqual({ direction: "both", speed: "fast" });

      setFlow({ direction: "none" });
      expect(flowOf(arrow)).toBe(null);
    });

    it("picking a speed on a still arrow starts it moving forward", () => {
      const arrow = API.createElement({ type: "arrow" });
      API.setElements([arrow]);
      API.setSelectedElements([arrow]);

      setFlow({ speed: "slow" });
      expect(flowOf(arrow)).toEqual({ direction: "forward", speed: "slow" });
    });

    it("shows moving packets only on arrows with a flow", () => {
      const still = API.createElement({
        type: "arrow",
        points: [pointFrom(0, 0), pointFrom(100, 0)],
      });
      const moving = API.createElement({
        type: "arrow",

        points: [pointFrom(0, 0), pointFrom(100, 0)],
      });
      act(() => API.setElements([still, moving]));
      expect(
        document.querySelector("[data-testid='arrow-flow-layer']"),
      ).toBeNull();

      API.setSelectedElements([moving]);
      setFlow({ direction: "both" });

      const layer = document.querySelector("[data-testid='arrow-flow-layer']")!;
      expect(layer).not.toBeNull();
      // one packet each way on a short arrow
      const motions = layer.querySelectorAll("animateMotion");
      expect(motions).toHaveLength(2);
      expect(
        [...motions].map((m) => m.getAttribute("keyPoints")).sort(),
      ).toEqual(["0;1", "1;0"]);
    });
  });
});
