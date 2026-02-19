import { vi } from "vitest";

import { CURSOR_TYPE } from "@excalidraw/common";
import { getElementAbsoluteCoords } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { getLinkHandleFromCoords } from "../components/hyperlink/helpers";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";
import { act, GlobalTestState, render, waitFor } from "./test-utils";

import type { ExcalidrawProps } from "../types";

describe("laser tool interactions", () => {
  const h = window.h;
  const mouse = new Pointer("mouse");

  it("opens links while using the laser tool", async () => {
    const onLinkOpenSpy = vi.fn();
    const onLinkOpen: NonNullable<ExcalidrawProps["onLinkOpen"]> = (
      ...args
    ) => {
      onLinkOpenSpy(...args);
      args[1].preventDefault();
    };
    await render(<Excalidraw onLinkOpen={onLinkOpen} />);

    const linkedRect = API.createElement({
      type: "rectangle",
      x: 20,
      y: 20,
      width: 120,
      height: 90,
    });
    API.setElements([linkedRect]);
    API.updateElement(linkedRect, {
      link: "https://example.com",
    });

    act(() => {
      h.app.setActiveTool({ type: "laser" });
    });

    const elementsMap = h.app.scene.getNonDeletedElementsMap();
    const currentRect = API.getElement(linkedRect);
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(currentRect, elementsMap);
    const [linkX, linkY, linkWidth, linkHeight] = getLinkHandleFromCoords(
      [x1, y1, x2, y2],
      currentRect.angle,
      h.state,
    );
    const iconCenterX = linkX + linkWidth / 2;
    const iconCenterY = linkY + linkHeight / 2;

    mouse.moveTo(iconCenterX, iconCenterY);
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.POINTER,
    );

    mouse.clickAt(iconCenterX, iconCenterY);
    expect(onLinkOpenSpy).toHaveBeenCalledTimes(1);
  });

  it("activates embeddables on center click while using the laser tool", async () => {
    await render(<Excalidraw />);

    const embeddable = API.createElement({
      type: "embeddable",
      x: 40,
      y: 40,
      width: 300,
      height: 180,
    });
    API.setElements([embeddable]);
    API.updateElement(embeddable, {
      link: "https://www.youtube.com/watch?v=gkGMXY0wekg",
    });

    act(() => {
      h.app.setActiveTool({ type: "laser" });
    });

    const handleIframeLikeCenterClickSpy = vi.spyOn(
      h.app as unknown as {
        handleIframeLikeCenterClick: () => void;
      },
      "handleIframeLikeCenterClick",
    );

    const centerX = embeddable.x + embeddable.width / 2;
    const centerY = embeddable.y + embeddable.height / 2;

    mouse.moveTo(centerX, centerY);
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.POINTER,
    );
    mouse.clickAt(centerX, centerY);

    expect(handleIframeLikeCenterClickSpy).toHaveBeenCalled();

    await waitFor(() => {
      expect(h.state.activeEmbeddable?.element.id).toBe(embeddable.id);
      expect(h.state.activeEmbeddable?.state).toBe("active");
    });

    handleIframeLikeCenterClickSpy.mockRestore();
  });
});
