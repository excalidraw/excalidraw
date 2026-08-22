import { vi } from "vitest";

import { CURSOR_TYPE } from "@excalidraw/common";
import { getElementAbsoluteCoords } from "@excalidraw/element";

import { Excalidraw } from "../index";
import { getLinkHandleFromCoords } from "../components/hyperlink/helpers";

import { API } from "./helpers/api";
import { Pointer } from "./helpers/ui";
import { act, GlobalTestState, render, waitFor } from "./test-utils";

import type { Collaborator, ExcalidrawProps, SocketId } from "../types";

describe("laser tool interactions", () => {
  const h = window.h;
  const mouse = new Pointer("mouse");

  it("retains persistent trails without keeping the animation running", async () => {
    await render(<Excalidraw />);

    API.setAppState({ laserPersistent: true });
    act(() => {
      h.app.setActiveTool({ type: "laser" });
      h.app.laserTrails.startPath(20, 20);
      h.app.laserTrails.addPointToPath(80, 80);
      h.app.laserTrails.endPath();
    });

    const path = document.querySelector<SVGPathElement>(".SVGLayer path")!;
    await waitFor(() => expect(path.getAttribute("d")).not.toBe(""));
    await waitFor(() =>
      expect(h.app.laserTrails.localTrail.isAnimating).toBe(false),
    );

    API.setAppState({ scrollX: 10 });
    await waitFor(() => expect(path.getAttribute("d")).not.toBe(""));

    API.setAppState({ laserPersistent: false });
    await waitFor(() => expect(path.getAttribute("d")).toBe(""));
  });

  it("clears persistent trails and broadcasts a new generation", async () => {
    const onPointerUpdate = vi.fn();
    await render(<Excalidraw onPointerUpdate={onPointerUpdate} />);

    API.setAppState({ laserPersistent: true });
    act(() => h.app.setActiveTool({ type: "laser" }));
    mouse.downAt(20, 20);
    mouse.moveTo(80, 80);
    mouse.upAt(80, 80);

    const previousGeneration = h.app.laserTrails.generation;
    act(() => h.app.clearLaserTrails());

    expect(h.app.laserTrails.generation).toBe(previousGeneration + 1);
    expect(onPointerUpdate.mock.calls.at(-1)![0].pointer).toMatchObject({
      tool: "laser",
      laserPersistent: true,
      laserTrailGeneration: previousGeneration + 1,
    });
  });

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

  it("activates embeddables covered by a higher z-index canvas element", async () => {
    await render(<Excalidraw />);

    const embeddable = API.createElement({
      type: "embeddable",
      x: 40,
      y: 40,
      width: 300,
      height: 180,
    });
    const coveringRectangle = API.createElement({
      type: "rectangle",
      x: 40,
      y: 40,
      width: 300,
      height: 180,
      backgroundColor: "#ff0000",
      fillStyle: "solid",
    });
    API.setElements([embeddable, coveringRectangle]);
    API.updateElement(embeddable, {
      link: "https://www.youtube.com/watch?v=gkGMXY0wekg",
    });

    act(() => {
      h.app.setActiveTool({ type: "laser" });
    });

    const centerX = embeddable.x + embeddable.width / 2;
    const centerY = embeddable.y + embeddable.height / 2;

    mouse.moveTo(centerX, centerY);
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.POINTER,
    );
    mouse.clickAt(centerX, centerY);

    await waitFor(() => {
      expect(h.state.activeEmbeddable?.element.id).toBe(embeddable.id);
      expect(h.state.activeEmbeddable?.state).toBe("active");
    });
  });

  it("doesn't pan in view mode when laser tool is active", async () => {
    await render(<Excalidraw />);

    API.setAppState({ viewModeEnabled: true });
    act(() => {
      h.app.setActiveTool({ type: "laser" });
    });

    expect(GlobalTestState.interactiveCanvas.style.cursor).toContain("");

    const initialScrollX = h.state.scrollX;
    const initialScrollY = h.state.scrollY;

    mouse.downAt(100, 100);
    mouse.moveTo(180, 160);
    mouse.upAt(180, 160);

    expect(h.state.scrollX).toBe(initialScrollX);
    expect(h.state.scrollY).toBe(initialScrollY);
    expect(GlobalTestState.interactiveCanvas.style.cursor).toContain("");
  });

  it("cleans up remote laser trails when the last collaborator leaves", async () => {
    await render(<Excalidraw />);

    const socketId = "socket-id" as SocketId;
    const collaborators = new Map<SocketId, Collaborator>([
      [
        socketId,
        {
          pointer: {
            x: 10,
            y: 10,
            tool: "laser",
          },
          button: "down",
        },
      ],
    ]);
    const svgLayer = document.querySelector(".SVGLayer svg")!;

    act(() => {
      h.app.updateScene({ collaborators });
    });

    expect(svgLayer.querySelectorAll("path")).toHaveLength(1);

    act(() => {
      h.app.updateScene({ collaborators: new Map() });
    });

    expect(svgLayer.querySelectorAll("path")).toHaveLength(0);
  });

  it("retains and generation-clears remote persistent laser trails", async () => {
    await render(<Excalidraw />);

    const socketId = "persistent-socket-id" as SocketId;
    const collaborator = (button: "up" | "down", generation: number) =>
      new Map<SocketId, Collaborator>([
        [
          socketId,
          {
            pointer: {
              x: button === "down" ? 10 : 80,
              y: button === "down" ? 10 : 80,
              tool: "laser",
              laserPersistent: true,
              laserTrailGeneration: generation,
            },
            button,
          },
        ],
      ]);

    act(() => h.app.updateScene({ collaborators: collaborator("down", 0) }));
    act(() => h.app.updateScene({ collaborators: collaborator("up", 0) }));

    const path = document.querySelector<SVGPathElement>(".SVGLayer path")!;
    await waitFor(() => expect(path.getAttribute("d")).not.toBe(""));

    act(() => h.app.updateScene({ collaborators: collaborator("up", 1) }));
    await waitFor(() => expect(path.getAttribute("d")).toBe(""));
  });
});

describe("iframe-like element hit testing outside frame bounds", () => {
  const h = window.h;
  const mouse = new Pointer("mouse");
  const iframeLikeTypes = ["embeddable", "iframe"] as const;

  const addFramedIframeLikeElement = (type: typeof iframeLikeTypes[number]) => {
    const frame = API.createElement({
      type: "frame",
      x: 40,
      y: 40,
      width: 100,
      height: 180,
    });
    const iframeLikeElement = API.createElement({
      type,
      x: 80,
      y: 40,
      width: 300,
      height: 180,
      frameId: frame.id,
    });
    API.setElements([frame, iframeLikeElement]);
    if (type === "embeddable") {
      API.updateElement(iframeLikeElement, {
        link: "https://www.youtube.com/watch?v=gkGMXY0wekg",
      });
    }

    return { frame, iframeLikeElement };
  };

  it.each(iframeLikeTypes)(
    "activates the visible part of a %s outside its frame",
    async (type) => {
      await render(<Excalidraw />);
      const { frame, iframeLikeElement } = addFramedIframeLikeElement(type);

      act(() => {
        h.app.setActiveTool({ type: "laser" });
      });

      const centerX = iframeLikeElement.x + iframeLikeElement.width / 2;
      const centerY = iframeLikeElement.y + iframeLikeElement.height / 2;
      expect(centerX).toBeGreaterThan(frame.x + frame.width);

      mouse.moveTo(centerX, centerY);
      expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
        CURSOR_TYPE.POINTER,
      );
      mouse.clickAt(centerX, centerY);

      await waitFor(() => {
        expect(h.state.activeEmbeddable?.element.id).toBe(iframeLikeElement.id);
        expect(h.state.activeEmbeddable?.state).toBe("active");
      });
    },
  );

  it.each(iframeLikeTypes)(
    "drags a %s from its visible part outside its frame",
    async (type) => {
      await render(<Excalidraw />);
      const { frame, iframeLikeElement } = addFramedIframeLikeElement(type);
      const startX = frame.x + frame.width + 20;
      const startY = iframeLikeElement.y + iframeLikeElement.height / 2;
      const initialX = iframeLikeElement.x;
      const initialY = iframeLikeElement.y;

      mouse.moveTo(startX, startY);
      mouse.downAt(startX, startY);
      mouse.moveTo(startX + 30, startY + 20);
      mouse.upAt(startX + 30, startY + 20);

      const draggedElement = API.getElement(iframeLikeElement);
      expect(draggedElement.x).toBe(initialX + 30);
      expect(draggedElement.y).toBe(initialY + 20);
    },
  );
});
