import { vi } from "vitest";

import { CURSOR_TYPE } from "@excalidraw/common";
import { getElementAbsoluteCoords } from "@excalidraw/element";
import { LaserPointer } from "@excalidraw/laser-pointer";

import { Excalidraw } from "../index";
import { getLinkHandleFromCoords } from "../components/hyperlink/helpers";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { act, fireEvent, GlobalTestState, render, waitFor } from "./test-utils";

import type { Collaborator, ExcalidrawProps, SocketId } from "../types";

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
});

describe("persistent annotations", () => {
  const h = window.h;
  const mouse = new Pointer("mouse");

  const selectTool = (tool: "annotation" | "laser") => {
    const ownerDocument = h.app.ownerDocument;
    fireEvent.click(
      ownerDocument.querySelector(".App-toolbar__extra-tools-trigger")!,
    );
    fireEvent.click(
      ownerDocument.querySelector(`[data-testid="toolbar-${tool}"]`)!,
    );
  };

  const startClock = () => {
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
    });
    h.app.ownerWindow.EXCALIDRAW_THROTTLE_RENDER = true;
  };

  afterEach(() => {
    h.app.ownerWindow.EXCALIDRAW_THROTTLE_RENDER = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each(["desktop", "phone"] as const)(
    "keeps long and multiple annotation strokes without an animation loop on %s",
    async (formFactor) => {
      await render(
        <Excalidraw UIOptions={{ getFormFactor: () => formFactor }} />,
      );
      fireEvent.resize(h.app.ownerWindow);
      await waitFor(() =>
        expect(h.app.editorInterface.formFactor).toBe(formFactor),
      );
      startClock();
      selectTool("annotation");
      expect(h.state.laserPersistent).toBe(true);

      const outlineSpy = vi.spyOn(LaserPointer.prototype, "getStrokeOutline");
      mouse.downAt(100, 100);
      for (let index = 1; index <= 70; index++) {
        mouse.moveTo(100 + index * 5, 100);
      }
      mouse.up();
      mouse.downAt(100, 200);
      mouse.moveTo(200, 200);
      mouse.up();

      const path = h.app.ownerDocument.querySelector(".SVGLayer path")!;
      const drawing = path.getAttribute("d")!;
      expect(drawing.match(/M/g)).toHaveLength(2);
      expect(Number(drawing.match(/^M(-?[\d.]+)/)![1])).toBeLessThan(110);
      expect(h.app.scene.getNonDeletedElements()).toHaveLength(0);

      outlineSpy.mockClear();
      act(() => vi.advanceTimersByTime(2000));
      expect(outlineSpy).not.toHaveBeenCalled();
      act(() => h.app.laserTrails.redrawAnnotations());
      expect(path.getAttribute("d")).toBe(drawing);
    },
  );

  it.each(["desktop", "phone"] as const)(
    "clears annotations without switching tools on %s",
    async (formFactor) => {
      await render(
        <Excalidraw UIOptions={{ getFormFactor: () => formFactor }} />,
      );
      fireEvent.resize(h.app.ownerWindow);
      await waitFor(() =>
        expect(h.app.editorInterface.formFactor).toBe(formFactor),
      );
      const rectangle = API.createElement({ type: "rectangle" });
      API.setElements([rectangle]);
      const ownerDocument = h.app.ownerDocument;
      const getClearButton = () =>
        ownerDocument.querySelector('[data-testid="clear-annotations"]');
      expect(getClearButton()).toBeNull();
      selectTool("annotation");
      expect(getClearButton()).toBeNull();

      mouse.downAt(100, 100);
      expect(getClearButton()).not.toBeNull();
      mouse.moveTo(200, 100);
      mouse.up();
      mouse.downAt(100, 200);
      mouse.moveTo(200, 200);
      mouse.up();
      expect(
        ownerDocument
          .querySelector(".SVGLayer path")!
          .getAttribute("d")!
          .match(/M/g),
      ).toHaveLength(2);

      const button = getClearButton()!;
      expect(button.getAttribute("aria-label")).toBe("Clear annotations");
      if (formFactor === "phone") {
        expect(button.closest(".clear-annotations--mobile")).not.toBeNull();
        expect(button.closest(".App-toolbar")).not.toBeNull();
        expect(button.closest(".mobile-toolbar")).toBeNull();
      } else {
        expect(button.closest(".App-toolbar-container")).not.toBeNull();
        expect(button.closest(".App-toolbar")).toBeNull();
      }
      fireEvent.click(button);
      expect(ownerDocument.querySelector(".SVGLayer path")).toBeNull();
      expect(getClearButton()).toBeNull();
      expect(h.state.activeTool.type).toBe("laser");
      expect(h.state.laserPersistent).toBe(true);
      expect(h.app.scene.getNonDeletedElements()).toEqual([rectangle]);

      API.setAppState({ scrollX: 50 });
      expect(ownerDocument.querySelector(".SVGLayer path")).toBeNull();
      mouse.downAt(100, 300);
      mouse.moveTo(200, 300);
      mouse.up();
      expect(getClearButton()).not.toBeNull();
      expect(
        ownerDocument
          .querySelector(".SVGLayer path")!
          .getAttribute("d")!
          .match(/M/g),
      ).toHaveLength(1);
    },
  );

  it("clears annotations when switching back to the fading laser", async () => {
    await render(<Excalidraw />);
    startClock();
    selectTool("annotation");
    mouse.downAt(100, 100);
    mouse.moveTo(200, 100);
    mouse.up();
    selectTool("laser");
    expect(h.state.laserPersistent).toBe(false);
    expect(h.app.ownerDocument.querySelector(".SVGLayer path")).toBeNull();
    expect(
      h.app.ownerDocument.querySelector('[data-testid="clear-annotations"]'),
    ).toBeNull();
    mouse.downAt(100, 200);
    mouse.moveTo(200, 200);
    mouse.up();
    expect(h.app.ownerDocument.querySelectorAll(".SVGLayer path")).toHaveLength(
      1,
    );

    act(() => vi.advanceTimersByTime(2000));
    expect(h.app.ownerDocument.querySelectorAll(".SVGLayer path")).toHaveLength(
      0,
    );
  });

  it.each(["toolbar", "keyboard", "scene update"] as const)(
    "clears all completed and in-progress annotations on a tool change via %s",
    async (source) => {
      await render(<Excalidraw />);
      selectTool("annotation");
      mouse.downAt(100, 100);
      mouse.moveTo(200, 100);
      mouse.up();
      mouse.downAt(100, 200);
      mouse.moveTo(200, 200);
      mouse.up();
      mouse.downAt(100, 300);
      mouse.moveTo(200, 300);
      const ownerDocument = h.app.ownerDocument;
      const path = ownerDocument.querySelector(".SVGLayer path")!;
      expect(path.getAttribute("d")!.match(/M/g)).toHaveLength(3);

      if (source === "toolbar") {
        fireEvent.click(
          ownerDocument.querySelector('[data-testid="toolbar-rectangle"]')!,
        );
      } else if (source === "keyboard") {
        Keyboard.keyPress("r", GlobalTestState.interactiveCanvas);
      } else {
        API.setAppState({
          activeTool: {
            ...h.state.activeTool,
            type: "selection",
            customType: null,
          },
        });
      }

      expect(h.state.activeTool.type).not.toBe("laser");
      expect(ownerDocument.querySelector(".SVGLayer path")).toBeNull();
      expect(
        ownerDocument.querySelector('[data-testid="clear-annotations"]'),
      ).toBeNull();
      mouse.up();
      selectTool("annotation");
      expect(ownerDocument.querySelector(".SVGLayer path")).toBeNull();
      API.setAppState({ scrollX: 50 });
      expect(ownerDocument.querySelector(".SVGLayer path")).toBeNull();
    },
  );

  it("keeps annotations when reselecting Annotation", async () => {
    await render(<Excalidraw />);
    selectTool("annotation");
    mouse.downAt(100, 100);
    mouse.moveTo(200, 100);
    mouse.up();
    const path = h.app.ownerDocument.querySelector(".SVGLayer path")!;
    const drawing = path.getAttribute("d");

    selectTool("annotation");
    expect(path.isConnected).toBe(true);
    expect(path.getAttribute("d")).toBe(drawing);
  });

  it("redraws retained annotations after panning and zooming", async () => {
    await render(<Excalidraw />);
    selectTool("annotation");
    mouse.downAt(100, 100);
    mouse.moveTo(200, 100);
    mouse.up();
    const path = h.app.ownerDocument.querySelector(".SVGLayer path")!;
    const drawing = path.getAttribute("d");

    API.setAppState({ scrollX: 50 });
    const pannedDrawing = path.getAttribute("d");
    expect(pannedDrawing).not.toBe(drawing);
    API.setAppState({ zoom: { value: 2 as typeof h.state.zoom.value } });
    expect(path.getAttribute("d")).not.toBe(pannedDrawing);
  });

  it("does not make collaborators' laser strokes persistent", async () => {
    await render(<Excalidraw />);
    startClock();
    selectTool("annotation");
    const socketId = "remote-laser" as SocketId;
    const updatePointer = (x: number, button: "down" | "up") => {
      act(() => {
        h.app.updateScene({
          collaborators: new Map([
            [socketId, { pointer: { x, y: 100, tool: "laser" }, button }],
          ]),
        });
      });
    };
    updatePointer(100, "down");
    updatePointer(200, "down");
    updatePointer(200, "up");
    expect(h.app.ownerDocument.querySelector(".SVGLayer path")).not.toBeNull();
    expect(
      h.app.ownerDocument.querySelector('[data-testid="clear-annotations"]'),
    ).toBeNull();

    act(() => vi.advanceTimersByTime(2000));
    expect(h.app.ownerDocument.querySelector(".SVGLayer path")).toBeNull();
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
