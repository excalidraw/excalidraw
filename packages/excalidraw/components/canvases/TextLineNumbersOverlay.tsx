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
  leftScene: number;
  topScene: number;
  widthScene: number;
  anchorXScene: number;
  anchorYScene: number;
  fontSizeScene: number;
  lineHeightScene: number;
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

  //解决文本框和行号移动不同步的问题2026.03.21
  // 将行号位置从“每帧按 scroll/zoom 重算”改为：缓存 scene 坐标锚点，仅在文本内容/尺寸变化时更新；
  // 平移/缩放时只更新 transform，避免每帧执行 wrapText + measureText 导致掉帧与橡皮筋效应。
  const elementCacheRef = useRef<
    Map<
      string,
      {
        signature: string;
        items: LineNumberButtonItem[];
      }
    >
  >(new Map());

  const items = useMemo(() => {
    if (isDisabled) {
      return [];
    }

    const cache = elementCacheRef.current;
    const nextVisibleIds = new Set<string>();
    const out: LineNumberButtonItem[] = [];

    for (const element of visibleElements) {
      if (!isTextElement(element) || element.angle) {
        continue;
      }

      nextVisibleIds.add(element.id);

      const font = getFontString(element) as any;
      const originalText = getOriginalText(element);

      const signature = [
        element.x,
        element.y,
        element.width,
        element.fontSize,
        element.lineHeight,
        font,
        originalText,
      ].join("|");

      const cached = cache.get(element.id);
      if (cached?.signature === signature) {
        out.push(...cached.items);
        continue;
      }

      const isHugeText = originalText.length > 8000;
      const { lines, explicitNewlineAfterLine } = isHugeText
        ? { lines: [], explicitNewlineAfterLine: [] as boolean[] }
        : wrapTextPreservingWhitespaceWithExplicitNewlineMarkers(
            originalText,
            font,
            element.width,
          );

      const lineHeightScene = getLineHeightInPx(
        element.fontSize,
        element.lineHeight,
      );
      const fontSizeScene = element.fontSize;
      const gapScene = Math.max(6, fontSizeScene * LINE_NUMBER_GAP_FACTOR);
      const anchorXLeftScene = element.x - gapScene;
      const anchorXRightScene = element.x + element.width + gapScene;

      const map = new Map<string, LineNumberButtonItem>();

      const addLine = (lineNumber: number, yCenterScene: number) => {
        const anchorYScene = yCenterScene;
        const topScene = anchorYScene - lineHeightScene / 2;
        const label = String(lineNumber);
        measureContext.font = `${fontSizeScene}px ${LINE_NUMBER_FONT_FAMILY}`;
        const widthScene = Math.max(
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
            leftScene: anchorXLeftScene - widthScene,
            topScene,
            widthScene,
            anchorXScene: anchorXLeftScene,
            anchorYScene,
            fontSizeScene,
            lineHeightScene,
            label,
          });
        }
        const rightKey = `${element.id}:right:${lineNumber}`;
        if (!map.has(rightKey)) {
          map.set(rightKey, {
            elementId: element.id,
            side: "right",
            lineNumber,
            leftScene: anchorXRightScene,
            topScene,
            widthScene,
            anchorXScene: anchorXRightScene,
            anchorYScene,
            fontSizeScene,
            lineHeightScene,
            label,
          });
        }
      };

      if (isHugeText) {
        const logicalLineCount = Math.max(1, originalText.split("\n").length);
        for (let lineNumber = 1; lineNumber <= logicalLineCount; lineNumber++) {
          const yCenterScene =
            element.y +
            (lineNumber - 1) * lineHeightScene +
            lineHeightScene / 2;
          addLine(lineNumber, yCenterScene);
        }
      } else {
        let currentLineNumber = 1;
        for (let i = 0; i < lines.length; i++) {
          const isLogicalLineStart =
            i === 0 || !!explicitNewlineAfterLine[i - 1];
          if (!isLogicalLineStart) {
            continue;
          }
          if (i > 0) {
            currentLineNumber += 1;
          }
          const yCenterScene =
            element.y + i * lineHeightScene + lineHeightScene / 2;
          addLine(currentLineNumber, yCenterScene);
        }
      }

      const elementItems = Array.from(map.values());
      cache.set(element.id, { signature, items: elementItems });
      out.push(...elementItems);
    }

    for (const id of Array.from(cache.keys())) {
      if (!nextVisibleIds.has(id)) {
        cache.delete(id);
      }
    }

    return out;
  }, [isDisabled, visibleElements]);

  const itemByKey = useMemo(() => {
    const map = new Map<string, LineNumberButtonItem>();
    for (const item of items) {
      map.set(`${item.elementId}:${item.side}:${item.lineNumber}`, item);
    }
    return map;
  }, [items]);

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
    const item = itemByKey.get(
      `${draft.elementId}:${draft.side}:${draft.lineNumber}`,
    );
    if (!item) {
      return null;
    }
    const zoom = appState.zoom.value;
    const scrollX = appState.scrollX;
    const scrollY = appState.scrollY;
    return {
      x: Math.round((item.anchorXScene + scrollX) * zoom),
      y: Math.round((item.anchorYScene + scrollY) * zoom),
    };
  }, [
    appState.scrollX,
    appState.scrollY,
    appState.textLineLinkDraft,
    appState.zoom.value,
    isDisabled,
    itemByKey,
  ]);

  const endAnchor = hovered
    ? itemByKey.get(
        `${hovered.elementId}:${hovered.side}:${hovered.lineNumber}`,
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
          const endAnchorX = Math.round(
            (endAnchor.anchorXScene + appState.scrollX) * appState.zoom.value,
          );
          const endAnchorY = Math.round(
            (endAnchor.anchorYScene + appState.scrollY) * appState.zoom.value,
          );
          const desiredSide: TextLineLinkSide =
            draft.side === "right" || hovered!.side === "right"
              ? "right"
              : "left";
          const a = getQuadraticArcParams({
            x1: startAnchor!.x,
            y1: startAnchor!.y,
            x2: endAnchorX,
            y2: endAnchorY,
            sign: 1,
            angleRad: SELF_LINK_ARC_ANGLE_RAD,
          });
          const b = getQuadraticArcParams({
            x1: startAnchor!.x,
            y1: startAnchor!.y,
            x2: endAnchorX,
            y2: endAnchorY,
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
      {/*解决文本框和行号移动不同步的问题2026.03.21*/}
      <div
        className="excalidraw__textLineNumbersOverlay__content"
        style={{
          transformOrigin: "0 0",
          transform: `translate(${appState.scrollX * appState.zoom.value}px, ${
            appState.scrollY * appState.zoom.value
          }px) scale(${appState.zoom.value})`,
          willChange: "transform",
        }}
      >
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
                left: item.leftScene,
                top: item.topScene,
                width: `${item.widthScene}px`,
                fontSize: item.fontSizeScene,
                height: `${item.lineHeightScene}px`,
                lineHeight: `${item.lineHeightScene}px`,
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const root = rootRef.current;
                if (root) {
                  const rect = root.getBoundingClientRect();
                  const nextCursor = {
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                  };
                  if (!appState.textLineLinkDraft) {
                    //解决点击行号没有拉出连接线的问题2026.03.21
                    // 进入 Draft 的同一事件里把 cursor 初始化为点击点，确保立即渲染“行号 → 光标”的草稿连线
                    setCursor(nextCursor);
                  } else {
                    setCursor(nextCursor);
                  }
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
      {appState.textLineLinkDraft && startAnchor && (cursor || endAnchor) && (
        <svg className="excalidraw__textLineNumbersOverlay__draft">
          {selfArcPath ? (
            <path d={selfArcPath} />
          ) : (
            <line
              x1={startAnchor.x}
              y1={startAnchor.y}
              x2={
                endAnchor
                  ? Math.round(
                      (endAnchor.anchorXScene + appState.scrollX) *
                        appState.zoom.value,
                    )
                  : cursor!.x
              }
              y2={
                endAnchor
                  ? Math.round(
                      (endAnchor.anchorYScene + appState.scrollY) *
                        appState.zoom.value,
                    )
                  : cursor!.y
              }
            />
          )}
        </svg>
      )}
    </div>
  );
};

export default React.memo(TextLineNumbersOverlay);
