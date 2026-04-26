import { useEffect, useRef, useState } from "react";

import { newElement, newElementWith, syncMovedIndices } from "@excalidraw/element";

import { arrayToMap, sceneCoordsToViewportCoords } from "@excalidraw/common";

import { EllipseIcon, RectangleIcon } from "./icons";
import { ToolButton } from "./ToolButton";

import "./ShapeRecognitionPopup.scss";

import type App from "./App";

const GAP = 10;

const ShapeRecognitionPopup = ({ app }: { app: App }) => {
  const pending = app.state.pendingShapeRecognition;
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!pending) return;
    const { x, y, height } = pending.bbox;
    const vp = sceneCoordsToViewportCoords(
      { sceneX: x, sceneY: y + height },
      app.state,
    );
    setPos({
      x: vp.x - app.state.offsetLeft,
      y: vp.y - app.state.offsetTop + GAP,
    });
  }, [pending, app.state]);

  if (!pending) return null;

  const dismiss = () => {
    app.setState({ pendingShapeRecognition: null });
  };

  const apply = (type: "rectangle" | "ellipse") => {
    const { freedrawId, bbox } = pending;
    const elements = app.scene.getElementsIncludingDeleted();
    const freedraw = elements.find((el) => el.id === freedrawId);
    if (!freedraw) {
      dismiss();
      return;
    }

    const recognized = newElement({
      type,
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      strokeColor: freedraw.strokeColor,
      backgroundColor: freedraw.backgroundColor,
      fillStyle: freedraw.fillStyle,
      strokeWidth: freedraw.strokeWidth,
      strokeStyle: freedraw.strokeStyle,
      roughness: freedraw.roughness,
      opacity: freedraw.opacity,
      groupIds: freedraw.groupIds,
      frameId: freedraw.frameId,
    });

    const withoutFreedraw = elements.map((el) =>
      el.id === freedrawId ? newElementWith(el, { isDeleted: true }) : el,
    );
    const nextElements = syncMovedIndices(
      [...withoutFreedraw, recognized],
      arrayToMap([recognized]),
    );

    app.scene.replaceAllElements(nextElements);
    app.setState({
      pendingShapeRecognition: null,
      selectedElementIds: { [recognized.id]: true },
    });
  };

  return (
    <div
      ref={panelRef}
      className="ShapeRecognitionPopup"
      style={{ left: pos.x, top: pos.y }}
    >
      <ToolButton
        type="button"
        icon={RectangleIcon}
        title="Rectangle"
        aria-label="Rectangle"
        onClick={() => apply("rectangle")}
      />
      <ToolButton
        type="button"
        icon={EllipseIcon}
        title="Circle / Ellipse"
        aria-label="Circle / Ellipse"
        onClick={() => apply("ellipse")}
      />
      <ToolButton
        type="button"
        icon={<span style={{ fontSize: 12, lineHeight: 1 }}>✕</span>}
        title="Keep freehand"
        aria-label="Keep freehand"
        onClick={dismiss}
      />
    </div>
  );
};

export default ShapeRecognitionPopup;
