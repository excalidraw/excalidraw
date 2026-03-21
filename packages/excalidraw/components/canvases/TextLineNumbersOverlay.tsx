import React, { useEffect, useMemo, useRef, useState } from "react";

import { getFontString, randomId } from "@excalidraw/common";

import {
  getLineHeightInPx,
  isTextElement,
  wrapTextPreservingWhitespaceWithExplicitNewlineMarkers,
} from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type {
  AppState,
  TextLineLinkEndpoint,
  TextLineLinkSide,
} from "../../types";

const SELF_LINK_ARC_ANGLE_RAD = Math.PI / 6;
const LINE_NUMBER_FONT_FAMILY = 'Cascadia, monospace, "Segoe UI Emoji"';
const LINE_NUMBER_PADDING_X = 6;
const LINE_NUMBER_GAP_FACTOR = 0.35;

const measureCanvas = document.createElement("canvas");
const measureContext = measureCanvas.getContext("2d")!;

type LineNumberButtonItem = {
  elementId: string;
  side: TextLineLinkSide;
  lineNumber: number;
  left: number;
  top: number;
  width: number;
  anchorX: number;
  anchorY: number;
  fontSize: number;
  lineHeight: number;
  label: string;
};

type TextLineNumbersOverlayProps = {
  visibleElements: readonly NonDeletedExcalidrawElement[];
  appState: Pick<
    AppState,
    | "zoom"
    | "scrollX"
    | "scrollY"
    | "selectedElementIds"
    | "textLineLinks"
    | "textLineLinkDraft"
  >;
  setAppState: React.Component<any, AppState>["setState"];
};

const getOriginalText = (element: any) =>
  typeof element?.originalText === "string"
    ? element.originalText
    : element.text;

const resolveFirstVisualLineIndexForLogicalLine = (
  element: any,
  logicalLineNumber: number,
  font: any,
) => {
  const originalText = getOriginalText(element);
  if (originalText.length > 8000) {
    return Math.max(
      0,
      Math.min(logicalLineNumber - 1, originalText.split("\n").length - 1),
    );
  }

  const { explicitNewlineAfterLine } =
    wrapTextPreservingWhitespaceWithExplicitNewlineMarkers(
      originalText,
      font,
      element.width,
    );

  let currentLineNumber = 1;
  for (let i = 0; i < explicitNewlineAfterLine.length; i++) {
    if (currentLineNumber === logicalLineNumber) {
      return i;
    }
    if (explicitNewlineAfterLine[i]) {
      currentLineNumber += 1;
    }
  }
  return 0;
};

const getQuadraticArcParams = ({
  x1,
  y1,
  x2,
  y2,
  sign,
  angleRad,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  sign: 1 | -1;
  angleRad: number;
}) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy) || 1;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const perpX = -dy / dist;
  const perpY = dx / dist;
  const offset = (dist / 2) * Math.tan(angleRad);
  const cx = midX + perpX * offset * sign;
  const cy = midY + perpY * offset * sign;
  return {
    cx,
    cy,
    d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`,
  };
};

const TextLineNumbersOverlay = ({
  visibleElements,
  appState,
  setAppState,
}: TextLineNumbersOverlayProps) => {
  const isDisabled =
    typeof window !== "undefined" &&
    !!(window as any).__EXCALIDRAW_DEBUG_DISABLE_TEXT_LINE_NUMBERS_OVERLAY__;

  const rootRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState<TextLineLinkEndpoint | null>(null);

  const items = useMemo(() => {
    if (isDisabled) {
      return [];
    }
    const zoom = appState.zoom.value;
    const scrollX = appState.scrollX;
    const scrollY = appState.scrollY;

    const map = new Map<string, LineNumberButtonItem>();

    for (const element of visibleElements) {
      if (!isTextElement(element) || element.angle) {
        continue;
      }

      const font = getFontString(element) as any;
      const originalText = getOriginalText(element);
      const isHugeText = originalText.length > 8000;
      const { lines, explicitNewlineAfterLine } = isHugeText
        ? { lines: [], explicitNewlineAfterLine: [] as boolean[] }
        : wrapTextPreservingWhitespaceWithExplicitNewlineMarkers(
            originalText,
            font,
            element.width,
          );

      const fontSize = Math.round(element.fontSize * zoom);
      const lineHeightScene = getLineHeightInPx(
        element.fontSize,
        element.lineHeight,
      );
      const lineHeight = Math.round(lineHeightScene * zoom);

      const gap = Math.round(Math.max(6, fontSize * LINE_NUMBER_GAP_FACTOR));
      const anchorXLeft = Math.round((element.x + scrollX) * zoom - gap);
      const anchorXRight = Math.round(
        (element.x + element.width + scrollX) * zoom + gap,
      );

      if (isHugeText) {
        const logicalLineCount = Math.max(1, originalText.split("\n").length);
        for (let lineNumber = 1; lineNumber <= logicalLineCount; lineNumber++) {
          const y =
            (element.y +
              (lineNumber - 1) * lineHeightScene +
              lineHeightScene / 2 +
              scrollY) *
            zoom;
          const anchorY = Math.round(y);
          const top = Math.round(anchorY - lineHeight / 2);
          const label = String(lineNumber);
          measureContext.font = `${fontSize}px ${LINE_NUMBER_FONT_FAMILY}`;
          const width = Math.max(
            1,
            Math.ceil(measureContext.measureText(label).width) +
              LINE_NUMBER_PADDING_X * 2,
          );
          const leftKey = `${element.id}:left:${lineNumber}`;
          if (!map.has(leftKey)) {
            map.set(leftKey, {
              elementId: element.id,
              side: "left",
              lineNumber,
              left: anchorXLeft - width,
              top,
              width,
              anchorX: anchorXLeft,
              anchorY,
              fontSize,
              lineHeight,
              label,
            });
          }
          const rightKey = `${element.id}:right:${lineNumber}`;
          if (!map.has(rightKey)) {
            map.set(rightKey, {
              elementId: element.id,
              side: "right",
              lineNumber,
              left: anchorXRight,
              top,
              width,
              anchorX: anchorXRight,
              anchorY,
              fontSize,
              lineHeight,
              label,
            });
          }
        }
        continue;
      }

      let currentLineNumber = 1;
      for (let i = 0; i < lines.length; i++) {
        const isLogicalLineStart = i === 0 || !!explicitNewlineAfterLine[i - 1];
        if (!isLogicalLineStart) {
          continue;
        }
        if (i > 0) {
          currentLineNumber += 1;
        }
        const y =
          (element.y + i * lineHeightScene + lineHeightScene / 2 + scrollY) *
          zoom;
        const anchorY = Math.round(y);
        const top = Math.round(anchorY - lineHeight / 2);
        const label = String(currentLineNumber);
        measureContext.font = `${fontSize}px ${LINE_NUMBER_FONT_FAMILY}`;
        const width = Math.max(
          1,
          Math.ceil(measureContext.measureText(label).width) +
            LINE_NUMBER_PADDING_X * 2,
        );
        const leftKey = `${element.id}:left:${currentLineNumber}`;
        if (!map.has(leftKey)) {
          map.set(leftKey, {
            elementId: element.id,
            side: "left",
            lineNumber: currentLineNumber,
            left: anchorXLeft - width,
            top,
            width,
            anchorX: anchorXLeft,
            anchorY,
            fontSize,
            lineHeight,
            label,
          });
        }
        const rightKey = `${element.id}:right:${currentLineNumber}`;
        if (!map.has(rightKey)) {
          map.set(rightKey, {
            elementId: element.id,
            side: "right",
            lineNumber: currentLineNumber,
            left: anchorXRight,
            top,
            width,
            anchorX: anchorXRight,
            anchorY,
            fontSize,
            lineHeight,
            label,
          });
        }
      }
    }

    return Array.from(map.values());
  }, [
    appState.scrollX,
    appState.scrollY,
    appState.zoom.value,
    isDisabled,
    visibleElements,
  ]);

  useEffect(() => {
    if (isDisabled) {
      setCursor(null);
      setHovered(null);
      return;
    }
    if (!appState.textLineLinkDraft) {
      setCursor(null);
      setHovered(null);
      return;
    }

    const onMove = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) {
        return;
      }
      const rect = root.getBoundingClientRect();
      setCursor({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [appState.textLineLinkDraft, isDisabled]);

  useEffect(() => {
    if (isDisabled) {
      return;
    }
    if (!appState.textLineLinkDraft) {
      return;
    }
    const onDownCapture = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element) {
        if (target.closest(".excalidraw__textLineNumberButton")) {
          return;
        }
      }
      setAppState({ textLineLinkDraft: null });
    };
    window.addEventListener("pointerdown", onDownCapture, true);
    return () => window.removeEventListener("pointerdown", onDownCapture, true);
  }, [appState.textLineLinkDraft, isDisabled, setAppState]);

  const onLineNumberPointerDown = (endpoint: TextLineLinkEndpoint) => {
    setAppState((state) => {
      const draft = state.textLineLinkDraft;
      if (
        draft &&
        (draft.elementId !== endpoint.elementId ||
          draft.lineNumber !== endpoint.lineNumber ||
          draft.side !== endpoint.side)
      ) {
        return {
          textLineLinks: state.textLineLinks.concat({
            id: randomId(),
            from: draft,
            to: endpoint,
          }),
          textLineLinkDraft: null,
        };
      }
      return {
        textLineLinks: state.textLineLinks,
        textLineLinkDraft: endpoint,
      };
    });
  };

  const startAnchor = useMemo(() => {
    if (isDisabled) {
      return null;
    }
    const draft = appState.textLineLinkDraft;
    if (!draft) {
      return null;
    }
    const el = visibleElements.find((e) => e.id === draft.elementId);
    if (!el || !isTextElement(el) || el.angle) {
      return null;
    }
    const zoom = appState.zoom.value;
    const scrollX = appState.scrollX;
    const scrollY = appState.scrollY;
    const lineHeightScene = getLineHeightInPx(el.fontSize, el.lineHeight);
    const font = getFontString(el) as any;
    const gapScene = Math.max(6, el.fontSize * LINE_NUMBER_GAP_FACTOR);
    const i = resolveFirstVisualLineIndexForLogicalLine(
      el,
      draft.lineNumber,
      font,
    );
    const yScene = el.y + i * lineHeightScene + lineHeightScene / 2;
    const xScene =
      draft.side === "left" ? el.x - gapScene : el.x + el.width + gapScene;
    return {
      x: Math.round((xScene + scrollX) * zoom),
      y: Math.round((yScene + scrollY) * zoom),
    };
  }, [
    appState.scrollX,
    appState.scrollY,
    appState.textLineLinkDraft,
    appState.zoom.value,
    isDisabled,
    visibleElements,
  ]);

  const endAnchor = hovered
    ? items.find(
        (it) =>
          it.elementId === hovered.elementId &&
          it.side === hovered.side &&
          it.lineNumber === hovered.lineNumber,
      )
    : null;

  const shouldRenderSelfArc =
    !!appState.textLineLinkDraft &&
    !!hovered &&
    appState.textLineLinkDraft.elementId === hovered.elementId &&
    (appState.textLineLinkDraft.lineNumber !== hovered.lineNumber ||
      appState.textLineLinkDraft.side !== hovered.side);

  const selfArcPath =
    endAnchor && shouldRenderSelfArc
      ? (() => {
          const draft = appState.textLineLinkDraft!;
          const desiredSide: TextLineLinkSide =
            draft.side === "right" || hovered!.side === "right"
              ? "right"
              : "left";
          const a = getQuadraticArcParams({
            x1: startAnchor!.x,
            y1: startAnchor!.y,
            x2: endAnchor.anchorX,
            y2: endAnchor.anchorY,
            sign: 1,
            angleRad: SELF_LINK_ARC_ANGLE_RAD,
          });
          const b = getQuadraticArcParams({
            x1: startAnchor!.x,
            y1: startAnchor!.y,
            x2: endAnchor.anchorX,
            y2: endAnchor.anchorY,
            sign: -1,
            angleRad: SELF_LINK_ARC_ANGLE_RAD,
          });
          const preferA = desiredSide === "right" ? a.cx >= b.cx : a.cx <= b.cx;
          return preferA ? a.d : b.d;
        })()
      : null;

  if (isDisabled) {
    return null;
  }

  return (
    <div ref={rootRef} className="excalidraw__textLineNumbersOverlay">
      {appState.textLineLinkDraft && startAnchor && (cursor || endAnchor) && (
        <svg className="excalidraw__textLineNumbersOverlay__draft">
          {selfArcPath ? (
            <path d={selfArcPath} />
          ) : (
            <line
              x1={startAnchor.x}
              y1={startAnchor.y}
              x2={endAnchor ? endAnchor.anchorX : cursor!.x}
              y2={endAnchor ? endAnchor.anchorY : cursor!.y}
            />
          )}
        </svg>
      )}
      {items.map((item, idx) => {
        const isDraft =
          !!appState.textLineLinkDraft &&
          appState.textLineLinkDraft.elementId === item.elementId &&
          appState.textLineLinkDraft.side === item.side &&
          appState.textLineLinkDraft.lineNumber === item.lineNumber;

        const isHovered =
          !!appState.textLineLinkDraft &&
          !!hovered &&
          hovered.elementId === item.elementId &&
          hovered.side === item.side &&
          hovered.lineNumber === item.lineNumber;

        const cls = `excalidraw__textLineNumberButton ${
          item.side === "left"
            ? "excalidraw__textLineNumberButton--left"
            : "excalidraw__textLineNumberButton--right"
        }${isDraft ? " is-draft" : ""}${isHovered ? " is-hovered" : ""}`;

        return (
          <button
            key={`${item.elementId}:${item.side}:${item.lineNumber}`}
            type="button"
            tabIndex={-1}
            className={cls}
            data-element-id={item.elementId}
            data-line-number={item.lineNumber}
            data-side={item.side}
            style={{
              left: item.left,
              top: item.top,
              width: `${item.width}px`,
              fontSize: item.fontSize,
              height: `${item.lineHeight}px`,
              lineHeight: `${item.lineHeight}px`,
            }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const root = rootRef.current;
              if (root) {
                const rect = root.getBoundingClientRect();
                setCursor({
                  x: event.clientX - rect.left,
                  y: event.clientY - rect.top,
                });
              }
              onLineNumberPointerDown({
                elementId: item.elementId,
                lineNumber: item.lineNumber,
                side: item.side,
              });
            }}
            onPointerEnter={() => {
              if (!appState.textLineLinkDraft) {
                return;
              }
              setHovered({
                elementId: item.elementId,
                lineNumber: item.lineNumber,
                side: item.side,
              });
            }}
            onPointerLeave={() => {
              setHovered(null);
            }}
            aria-label={`line ${item.lineNumber} ${item.side}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

export default React.memo(TextLineNumbersOverlay);
