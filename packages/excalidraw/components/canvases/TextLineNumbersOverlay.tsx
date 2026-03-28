import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  getFontFamilyString,
  getFontString,
  randomId,
} from "@excalidraw/common";

import {
  getLineHeightInPx,
  isTextElement,
  forEachWrappedLine,
} from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type {
  AppState,
  TextLineLinkEndpoint,
  TextLineLinkSide,
} from "../../types";

const SELF_LINK_ARC_ANGLE_RAD = Math.PI / 6;
const LINE_NUMBER_PADDING_X = 2;

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
  fontFamilyScene: string;
  lineHeightScene: number;
  label: string;
};

type SummaryToolCommentHintItem = {
  key: string;
  elementId: string;
  leftScene: number;
  topScene: number;
  fontSizeScene: number;
  fontFamilyScene: string;
  lineHeightScene: number;
  text: string;
};

type TextLineNumbersOverlayProps = {
  visibleElements: readonly NonDeletedExcalidrawElement[];
  appState: Pick<
    AppState,
    | "zoom"
    | "scrollX"
    | "scrollY"
    | "width"
    | "height"
    | "selectedElementIds"
    | "textLineLinks"
    | "textLineLinkDraft"
  >;
  setAppState: React.Component<any, AppState>["setState"];
  onResizeTextElementWidth: (args: {
    elementId: string;
    x: number;
    width: number;
  }) => void;
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
  onResizeTextElementWidth,
}: TextLineNumbersOverlayProps) => {
  const isDisabled =
    typeof window !== "undefined" &&
    !!(window as any).__EXCALIDRAW_DEBUG_DISABLE_TEXT_LINE_NUMBERS_OVERLAY__;

  const rootRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState<TextLineLinkEndpoint | null>(null);
  const [isAltDown, setIsAltDown] = useState(false);

  const resizeStateRef = useRef<{
    elementId: string;
    side: TextLineLinkSide;
    startClientX: number;
    latestClientX: number;
    startX: number;
    startWidth: number;
    pointerId: number;
    rafId: number | null;
    captureTarget: HTMLElement | null;
  } | null>(null);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const state = resizeStateRef.current;
      if (!state) {
        return;
      }
      if (event.pointerId !== state.pointerId) {
        return;
      }
      state.latestClientX = event.clientX;
      if (state.rafId != null) {
        return;
      }
      state.rafId = window.requestAnimationFrame(() => {
        const latest = resizeStateRef.current;
        if (!latest || latest.pointerId !== event.pointerId) {
          return;
        }
        latest.rafId = null;
        const dxScene =
          (latest.latestClientX - latest.startClientX) / appState.zoom.value;
        const minWidth = 20;
        if (latest.side === "right") {
          const nextWidth = Math.max(minWidth, latest.startWidth + dxScene);
          onResizeTextElementWidth({
            elementId: latest.elementId,
            x: latest.startX,
            width: nextWidth,
          });
        } else {
          const nextWidth = Math.max(minWidth, latest.startWidth - dxScene);
          const nextX = latest.startX + (latest.startWidth - nextWidth);
          onResizeTextElementWidth({
            elementId: latest.elementId,
            x: nextX,
            width: nextWidth,
          });
        }
      });
    };

    const stop = (event: PointerEvent) => {
      const state = resizeStateRef.current;
      if (!state) {
        return;
      }
      if (event.pointerId !== state.pointerId) {
        return;
      }
      state.latestClientX = event.clientX;
      if (state.rafId != null) {
        window.cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }

      const dxScene =
        (state.latestClientX - state.startClientX) / appState.zoom.value;
      const minWidth = 20;
      if (state.side === "right") {
        const nextWidth = Math.max(minWidth, state.startWidth + dxScene);
        onResizeTextElementWidth({
          elementId: state.elementId,
          x: state.startX,
          width: nextWidth,
        });
      } else {
        const nextWidth = Math.max(minWidth, state.startWidth - dxScene);
        const nextX = state.startX + (state.startWidth - nextWidth);
        onResizeTextElementWidth({
          elementId: state.elementId,
          x: nextX,
          width: nextWidth,
        });
      }

      const captureTarget = state.captureTarget;
      resizeStateRef.current = null;
      document.body.style.cursor = "";
      if (captureTarget) {
        try {
          captureTarget.releasePointerCapture(event.pointerId);
        } catch {}
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", stop, { passive: true });
    window.addEventListener("pointercancel", stop, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [appState.zoom.value, onResizeTextElementWidth]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        setIsAltDown(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        setIsAltDown(false);
      }
    };
    const onBlur = () => setIsAltDown(false);
    document.addEventListener("keydown", onKeyDown, { capture: true });
    document.addEventListener("keyup", onKeyUp, { capture: true });
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("keydown", onKeyDown, { capture: true });
      document.removeEventListener("keyup", onKeyUp, { capture: true });
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  //行号连接线在文本框的部分设为不显示2026.03.22
  const draftMaskId = useMemo(
    () => `excalidraw-textLineLinkDraftMask-${randomId()}`,
    [],
  );

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

  const borderBoxes = useMemo(() => {
    if (isDisabled) {
      return [];
    }
    const out: Array<{
      elementId: string;
      leftScene: number;
      topScene: number;
      widthScene: number;
      heightScene: number;
    }> = [];
    for (const element of visibleElements) {
      if (!isTextElement(element) || element.angle) {
        continue;
      }
      out.push({
        elementId: element.id,
        leftScene: element.x,
        topScene: element.y,
        widthScene: element.width,
        heightScene: element.height,
      });
    }
    return out;
  }, [isDisabled, visibleElements]);

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

      const lineHeightScene = getLineHeightInPx(
        element.fontSize,
        element.lineHeight,
      );
      const fontSizeScene = element.fontSize;
      const fontFamilyScene = getFontFamilyString({
        fontFamily: element.fontFamily,
      });
      const anchorXLeftScene = element.x;
      const anchorXRightScene = element.x + element.width;

      const map = new Map<string, LineNumberButtonItem>();

      const addLine = (lineNumber: number, yCenterScene: number) => {
        const anchorYScene = yCenterScene;
        const topScene = anchorYScene - lineHeightScene / 2;
        const label = String(lineNumber);
        measureContext.font = `${fontSizeScene}px ${fontFamilyScene}`;
        const widthScene = Math.max(
          1,
          Math.ceil(measureContext.measureText(label).width) +
            LINE_NUMBER_PADDING_X * 2,
        );
        const leftScene = anchorXLeftScene - widthScene;
        const rightScene = anchorXRightScene;
        const anchorXLeftCenterScene = leftScene + widthScene / 2;
        const anchorXRightCenterScene = rightScene + widthScene / 2;
        const leftKey = `${element.id}:left:${lineNumber}`;
        if (!map.has(leftKey)) {
          map.set(leftKey, {
            elementId: element.id,
            side: "left",
            lineNumber,
            leftScene,
            topScene,
            widthScene,
            anchorXScene: anchorXLeftCenterScene,
            anchorYScene,
            fontSizeScene,
            fontFamilyScene,
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
            leftScene: rightScene,
            topScene,
            widthScene,
            anchorXScene: anchorXRightCenterScene,
            anchorYScene,
            fontSizeScene,
            fontFamilyScene,
            lineHeightScene,
            label,
          });
        }
      };

      //文本框增量换行,逐行渲染2026.3.28
      const viewTopScene = -appState.scrollY;
      const viewBottomScene =
        viewTopScene + appState.height / appState.zoom.value;
      let logicalLineNumber = 1;
      let isLogicalLineStart = true;
      forEachWrappedLine(
        originalText,
        font,
        element.width,
        true,
        ({ lineIndex, explicitNewlineAfterLine }) => {
          const yCenterScene =
            element.y + lineIndex * lineHeightScene + lineHeightScene / 2;
          if (isLogicalLineStart) {
            if (
              yCenterScene >= viewTopScene - lineHeightScene &&
              yCenterScene <= viewBottomScene + lineHeightScene
            ) {
              addLine(logicalLineNumber, yCenterScene);
            }
          }
          if (explicitNewlineAfterLine) {
            logicalLineNumber += 1;
            isLogicalLineStart = true;
          } else {
            isLogicalLineStart = false;
          }
        },
      );

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
  }, [
    isDisabled,
    visibleElements,
    appState.scrollY,
    appState.height,
    appState.zoom.value,
  ]);

  const itemByKey = useMemo(() => {
    const map = new Map<string, LineNumberButtonItem>();
    for (const item of items) {
      map.set(`${item.elementId}:${item.side}:${item.lineNumber}`, item);
    }
    return map;
  }, [items]);

  const summaryToolDecorations = useMemo(() => {
    const getLineItem = (elementId: string, lineNumber: number) =>
      itemByKey.get(`${elementId}:left:${lineNumber}`) ||
      itemByKey.get(`${elementId}:right:${lineNumber}`) ||
      null;

    const commentHints: SummaryToolCommentHintItem[] = [];
    for (const element of visibleElements) {
      if (!isTextElement(element) || element.isDeleted || element.angle) {
        continue;
      }
      const summaryTool = (element.customData as any)?.summaryTool;
      if (!summaryTool || summaryTool.role !== "summaryRoot") {
        continue;
      }
      const model = summaryTool.model;
      const lists = model?.lists;
      if (!lists) {
        continue;
      }
      const displayMode = summaryTool.commentsDisplayMode as
        | "off"
        | "single"
        | "all"
        | undefined;
      for (const list of Object.values<any>(lists)) {
        if (displayMode && displayMode !== "single") {
          continue;
        }
        if (!displayMode && list?.display?.mode !== "single") {
          continue;
        }
        const rendered = list?.rendered;
        const hintByLineId = rendered?.commentHintByLineId as
          | Record<string, string>
          | undefined;
        const hintLineNumberByLineId =
          rendered?.commentHintLineNumberByLineId as
            | Record<string, number>
            | undefined;
        if (!hintByLineId || !hintLineNumberByLineId) {
          continue;
        }
        for (const [lineId, hintText] of Object.entries(hintByLineId)) {
          const lineNumber = hintLineNumberByLineId[lineId];
          if (!lineNumber) {
            continue;
          }
          const lineItem =
            itemByKey.get(`${element.id}:left:${lineNumber}`) ||
            getLineItem(element.id, lineNumber);
          if (!lineItem) {
            continue;
          }

          measureContext.font = `${lineItem.fontSizeScene}px ${lineItem.fontFamilyScene}`;
          const hintWidth = Math.ceil(
            measureContext.measureText(hintText).width,
          );
          const padding = 6;

          commentHints.push({
            key: `${element.id}:${lineId}`,
            elementId: element.id,
            leftScene: lineItem.leftScene - hintWidth - padding,
            topScene: lineItem.topScene,
            fontSizeScene: lineItem.fontSizeScene,
            fontFamilyScene: lineItem.fontFamilyScene,
            lineHeightScene: lineItem.lineHeightScene,
            text: hintText,
          });
        }
      }
    }

    return { commentHints };
  }, [itemByKey, visibleElements]);

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
        if (
          draft.elementId === endpoint.elementId &&
          draft.lineNumber === endpoint.lineNumber
        ) {
          return {
            textLineLinks: state.textLineLinks,
            textLineLinkDraft: draft,
          };
        }
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
        {borderBoxes.map((box) => (
          <div
            key={box.elementId}
            className="excalidraw__textLineNumbersOverlay__textBorder"
            style={{
              left: box.leftScene,
              top: box.topScene,
              width: `${box.widthScene}px`,
              height: `${box.heightScene}px`,
            }}
          />
        ))}
        {summaryToolDecorations.commentHints.map((item) => (
          <div
            key={item.key}
            className="excalidraw__summaryToolCommentHint"
            style={{
              left: item.leftScene,
              top: item.topScene,
              fontSize: item.fontSizeScene,
              fontFamily: item.fontFamilyScene,
              lineHeight: `${item.lineHeightScene}px`,
            }}
          >
            {item.text}
          </div>
        ))}
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

          const isAltReady =
            !appState.textLineLinkDraft &&
            isAltDown &&
            !!appState.selectedElementIds[item.elementId];

          const cls = `excalidraw__textLineNumberButton ${
            item.side === "left"
              ? "excalidraw__textLineNumberButton--left"
              : "excalidraw__textLineNumberButton--right"
          }${isDraft ? " is-draft" : ""}${isHovered ? " is-hovered" : ""}${
            isAltReady ? " is-alt-ready" : ""
          }`;

          //点击选中文本框才能点击行号拉出行号连接线;2026.03.22
          const canInteract =
            !!appState.textLineLinkDraft ||
            !!appState.selectedElementIds[item.elementId];
          const canResize =
            !!appState.selectedElementIds[item.elementId] &&
            !appState.textLineLinkDraft;

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
                fontFamily: item.fontFamilyScene,
                height: `${item.lineHeightScene}px`,
                lineHeight: `${item.lineHeightScene}px`,
                pointerEvents: canInteract ? "auto" : "none",
                cursor: canResize ? "ew-resize" : undefined,
              }}
              onPointerDown={(event) => {
                if (!canInteract) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();

                if (!appState.textLineLinkDraft && canResize && !event.altKey) {
                  const element = visibleElements.find(
                    (el) => el.id === item.elementId,
                  );
                  if (!element || !isTextElement(element) || element.angle) {
                    return;
                  }
                  event.currentTarget.setPointerCapture(event.pointerId);
                  resizeStateRef.current = {
                    elementId: item.elementId,
                    side: item.side,
                    startClientX: event.clientX,
                    latestClientX: event.clientX,
                    startX: element.x,
                    startWidth: element.width,
                    pointerId: event.pointerId,
                    rafId: null,
                    captureTarget: event.currentTarget,
                  };
                  document.body.style.cursor = "ew-resize";
                  return;
                }

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
        <svg
          className="excalidraw__textLineNumbersOverlay__draft"
          width={appState.width}
          height={appState.height}
        >
          <defs>
            <mask id={draftMaskId} maskUnits="userSpaceOnUse">
              <rect
                x={0}
                y={0}
                width={appState.width}
                height={appState.height}
                fill="white"
              />
              {borderBoxes.map((box) => (
                <rect
                  key={box.elementId}
                  x={Math.round(
                    (box.leftScene + appState.scrollX) * appState.zoom.value,
                  )}
                  y={Math.round(
                    (box.topScene + appState.scrollY) * appState.zoom.value,
                  )}
                  width={Math.round(box.widthScene * appState.zoom.value)}
                  height={Math.round(box.heightScene * appState.zoom.value)}
                  fill="black"
                />
              ))}
            </mask>
          </defs>
          {selfArcPath ? (
            <path d={selfArcPath} mask={`url(#${draftMaskId})`} />
          ) : (
            <line
              x1={startAnchor.x}
              y1={startAnchor.y}
              mask={`url(#${draftMaskId})`}
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
