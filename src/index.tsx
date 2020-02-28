import React from "react";
import ReactDOM from "react-dom";

import rough from "roughjs/bin/rough";
import { RoughCanvas } from "roughjs/bin/canvas";

import {
  newElement,
  newTextElement,
  duplicateElement,
  resizeTest,
  normalizeResizeHandle,
  isInvisiblySmallElement,
  isTextElement,
  textWysiwyg,
  getCommonBounds,
  getCursorForResizingElement,
  getPerfectElementSize,
  normalizeDimensions,
} from "./element";
import {
  clearSelection,
  deleteSelectedElements,
  getElementsWithinSelection,
  isOverScrollBars,
  saveToLocalStorage,
  getElementAtPosition,
  createScene,
  getElementContainingPosition,
  hasBackground,
  hasStroke,
  hasText,
  exportCanvas,
  loadScene,
  calculateScrollCenter,
  loadFromBlob,
  getZoomOrigin,
  getNormalizedZoom,
  getSelectedElements,
  isSomeElementSelected,
} from "./scene";

import { renderScene } from "./renderer";
import { AppState, FlooredNumber, Gesture } from "./types";
import { ExcalidrawElement } from "./element/types";

import {
  isWritableElement,
  isInputLike,
  isToolIcon,
  debounce,
  capitalizeString,
  distance,
  distance2d,
  resetCursor,
} from "./utils";
import { KEYS, isArrowKey } from "./keys";

import { findShapeByKey, shapesShortcutKeys, SHAPES } from "./shapes";
import { createHistory } from "./history";

import ContextMenu from "./components/ContextMenu";

import "./styles.scss";
import { getElementWithResizeHandler } from "./element/resizeTest";
import {
  ActionManager,
  actionDeleteSelected,
  actionSendBackward,
  actionBringForward,
  actionSendToBack,
  actionBringToFront,
  actionSelectAll,
  actionChangeStrokeColor,
  actionChangeBackgroundColor,
  actionChangeOpacity,
  actionChangeStrokeWidth,
  actionChangeFillStyle,
  actionChangeSloppiness,
  actionChangeFontSize,
  actionChangeFontFamily,
  actionChangeViewBackgroundColor,
  actionClearCanvas,
  actionZoomIn,
  actionZoomOut,
  actionResetZoom,
  actionChangeProjectName,
  actionChangeExportBackground,
  actionLoadScene,
  actionSaveScene,
  actionCopyStyles,
  actionPasteStyles,
  actionFinalize,
} from "./actions";
import { Action, ActionResult } from "./actions/types";
import { getDefaultAppState } from "./appState";
import { Island } from "./components/Island";
import Stack from "./components/Stack";
import { FixedSideContainer } from "./components/FixedSideContainer";
import { ToolButton } from "./components/ToolButton";
import { LockIcon } from "./components/LockIcon";
import { ExportDialog } from "./components/ExportDialog";
import { LanguageList } from "./components/LanguageList";
import { Point } from "roughjs/bin/geometry";
import { t, languages, setLanguage, getLanguage } from "./i18n";
import { HintViewer } from "./components/HintViewer";
import useIsMobile, { IsMobileProvider } from "./is-mobile";

import { copyToAppClipboard, getClipboardContent } from "./clipboard";
import { normalizeScroll } from "./scene/data";
import { getCenter, getDistance } from "./gesture";
import { menu, palette } from "./components/icons";

let { elements } = createScene();
const { history } = createHistory();

function setCursorForShape(shape: string) {
  if (shape === "selection") {
    resetCursor();
  } else {
    document.documentElement.style.cursor =
      shape === "text" ? CURSOR_TYPE.TEXT : CURSOR_TYPE.CROSSHAIR;
  }
}

const DRAGGING_THRESHOLD = 10; // 10px
const ELEMENT_SHIFT_TRANSLATE_AMOUNT = 5;
const ELEMENT_TRANSLATE_AMOUNT = 1;
const TEXT_TO_CENTER_SNAP_THRESHOLD = 30;
const CURSOR_TYPE = {
  TEXT: "text",
  CROSSHAIR: "crosshair",
  GRABBING: "grabbing",
};
const POINTER_BUTTON = {
  MAIN: 0,
  WHEEL: 1,
  SECONDARY: 2,
  TOUCH: -1,
};

// Block pinch-zooming on iOS outside of the content area
document.addEventListener(
  "touchmove",
  function(event) {
    // @ts-ignore
    if (event.scale !== 1) {
      event.preventDefault();
    }
  },
  { passive: false },
);

let lastPointerUp: ((event: any) => void) | null = null;
const gesture: Gesture = {
  pointers: [],
  lastCenter: null,
  initialDistance: null,
  initialScale: null,
};

export function viewportCoordsToSceneCoords(
  { clientX, clientY }: { clientX: number; clientY: number },
  {
    scrollX,
    scrollY,
    zoom,
  }: {
    scrollX: FlooredNumber;
    scrollY: FlooredNumber;
    zoom: number;
  },
  canvas: HTMLCanvasElement | null,
) {
  const zoomOrigin = getZoomOrigin(canvas);
  const clientXWithZoom = zoomOrigin.x + (clientX - zoomOrigin.x) / zoom;
  const clientYWithZoom = zoomOrigin.y + (clientY - zoomOrigin.y) / zoom;

  const x = clientXWithZoom - scrollX;
  const y = clientYWithZoom - scrollY;

  return { x, y };
}

export function sceneCoordsToViewportCoords(
  { sceneX, sceneY }: { sceneX: number; sceneY: number },
  {
    scrollX,
    scrollY,
    zoom,
  }: {
    scrollX: FlooredNumber;
    scrollY: FlooredNumber;
    zoom: number;
  },
  canvas: HTMLCanvasElement | null,
) {
  const zoomOrigin = getZoomOrigin(canvas);
  const sceneXWithZoomAndScroll =
    zoomOrigin.x - (zoomOrigin.x - sceneX - scrollX) * zoom;
  const sceneYWithZoomAndScroll =
    zoomOrigin.y - (zoomOrigin.y - sceneY - scrollY) * zoom;

  const x = sceneXWithZoomAndScroll;
  const y = sceneYWithZoomAndScroll;

  return { x, y };
}

let cursorX = 0;
let cursorY = 0;
let isHoldingSpace: boolean = false;
let isPanning: boolean = false;

interface LayerUIProps {
  actionManager: ActionManager;
  appState: AppState;
  canvas: HTMLCanvasElement | null;
  setAppState: any;
  elements: readonly ExcalidrawElement[];
  language: string;
  setElements: (elements: readonly ExcalidrawElement[]) => void;
}

const LayerUI = React.memo(
  ({
    actionManager,
    appState,
    setAppState,
    canvas,
    elements,
    language,
    setElements,
  }: LayerUIProps) => {
    const isMobile = useIsMobile();

    function renderExportDialog() {
      return (
        <ExportDialog
          elements={elements}
          appState={appState}
          actionManager={actionManager}
          onExportToPng={(exportedElements, scale) => {
            if (canvas) {
              exportCanvas("png", exportedElements, canvas, {
                exportBackground: appState.exportBackground,
                name: appState.name,
                viewBackgroundColor: appState.viewBackgroundColor,
                scale,
              });
            }
          }}
          onExportToSvg={(exportedElements, scale) => {
            if (canvas) {
              exportCanvas("svg", exportedElements, canvas, {
                exportBackground: appState.exportBackground,
                name: appState.name,
                viewBackgroundColor: appState.viewBackgroundColor,
                scale,
              });
            }
          }}
          onExportToClipboard={(exportedElements, scale) => {
            if (canvas) {
              exportCanvas("clipboard", exportedElements, canvas, {
                exportBackground: appState.exportBackground,
                name: appState.name,
                viewBackgroundColor: appState.viewBackgroundColor,
                scale,
              });
            }
          }}
          onExportToBackend={exportedElements => {
            if (canvas) {
              exportCanvas(
                "backend",
                exportedElements.map(element => ({
                  ...element,
                  isSelected: false,
                })),
                canvas,
                appState,
              );
            }
          }}
        />
      );
    }

    const showSelectedShapeActions = Boolean(
      appState.editingElement ||
        getSelectedElements(elements).length ||
        appState.elementType !== "selection",
    );

    function renderSelectedShapeActions() {
      const { elementType, editingElement } = appState;
      const targetElements = editingElement
        ? [editingElement]
        : getSelectedElements(elements);
      return (
        <div className="panelColumn">
          {actionManager.renderAction("changeStrokeColor")}
          {(hasBackground(elementType) ||
            targetElements.some(element => hasBackground(element.type))) && (
            <>
              {actionManager.renderAction("changeBackgroundColor")}

              {actionManager.renderAction("changeFillStyle")}
            </>
          )}

          {(hasStroke(elementType) ||
            targetElements.some(element => hasStroke(element.type))) && (
            <>
              {actionManager.renderAction("changeStrokeWidth")}

              {actionManager.renderAction("changeSloppiness")}
            </>
          )}

          {(hasText(elementType) ||
            targetElements.some(element => hasText(element.type))) && (
            <>
              {actionManager.renderAction("changeFontSize")}

              {actionManager.renderAction("changeFontFamily")}
            </>
          )}

          {actionManager.renderAction("changeOpacity")}

          <fieldset>
            <legend>{t("labels.layers")}</legend>
            <div className="buttonList">
              {actionManager.renderAction("sendToBack")}
              {actionManager.renderAction("sendBackward")}
              {actionManager.renderAction("bringToFront")}
              {actionManager.renderAction("bringForward")}
            </div>
          </fieldset>
        </div>
      );
    }

    function renderShapesSwitcher() {
      return (
        <>
          {SHAPES.map(({ value, icon }, index) => {
            const label = t(`toolBar.${value}`);
            return (
              <ToolButton
                key={value}
                type="radio"
                icon={icon}
                checked={appState.elementType === value}
                name="editor-current-shape"
                title={`${capitalizeString(label)} — ${
                  capitalizeString(value)[0]
                }, ${index + 1}`}
                keyBindingLabel={`${index + 1}`}
                aria-label={capitalizeString(label)}
                aria-keyshortcuts={`${label[0]} ${index + 1}`}
                onChange={() => {
                  setAppState({ elementType: value, multiElement: null });
                  setElements(clearSelection(elements));
                  document.documentElement.style.cursor =
                    value === "text" ? CURSOR_TYPE.TEXT : CURSOR_TYPE.CROSSHAIR;
                  setAppState({});
                }}
              ></ToolButton>
            );
          })}
        </>
      );
    }

    function renderZoomActions() {
      return (
        <Stack.Col gap={1}>
          <Stack.Row gap={1} align="center">
            {actionManager.renderAction(actionZoomIn.name)}
            {actionManager.renderAction(actionZoomOut.name)}
            {actionManager.renderAction(actionResetZoom.name)}
            <div style={{ marginLeft: 4 }}>
              {(appState.zoom * 100).toFixed(0)}%
            </div>
          </Stack.Row>
        </Stack.Col>
      );
    }

    return isMobile ? (
      <>
        {appState.openedMenu === "canvas" ? (
          <section
            className="App-mobile-menu"
            aria-labelledby="canvas-actions-title"
          >
            <h2 className="visually-hidden" id="canvas-actions-title">
              {t("headings.canvasActions")}
            </h2>
            <div className="App-mobile-menu-scroller panelColumn">
              <Stack.Col gap={4}>
                {actionManager.renderAction("loadScene")}
                {actionManager.renderAction("saveScene")}
                {renderExportDialog()}
                {actionManager.renderAction("clearCanvas")}
                {actionManager.renderAction("changeViewBackgroundColor")}
                <fieldset>
                  <legend>{t("labels.language")}</legend>
                  <LanguageList
                    onChange={lng => {
                      setLanguage(lng);
                      setAppState({});
                    }}
                    languages={languages}
                    currentLanguage={language}
                  />
                </fieldset>
              </Stack.Col>
            </div>
          </section>
        ) : appState.openedMenu === "shape" && showSelectedShapeActions ? (
          <section
            className="App-mobile-menu"
            aria-labelledby="selected-shape-title"
          >
            <h2 className="visually-hidden" id="selected-shape-title">
              {t("headings.selectedShapeActions")}
            </h2>
            <div className="App-mobile-menu-scroller">
              {renderSelectedShapeActions()}
            </div>
          </section>
        ) : null}
        <FixedSideContainer side="top">
          <section aria-labelledby="shapes-title">
            <Stack.Col gap={4} align="center">
              <Stack.Row gap={1}>
                <Island padding={1}>
                  <h2 className="visually-hidden" id="shapes-title">
                    {t("headings.shapes")}
                  </h2>
                  <Stack.Row gap={1}>{renderShapesSwitcher()}</Stack.Row>
                </Island>
              </Stack.Row>
            </Stack.Col>
          </section>
          <HintViewer
            elementType={appState.elementType}
            multiMode={appState.multiElement !== null}
            isResizing={appState.isResizing}
            elements={elements}
          />
        </FixedSideContainer>
        <footer className="App-toolbar">
          <div className="App-toolbar-content">
            {appState.multiElement ? (
              <>
                {actionManager.renderAction("deleteSelectedElements")}
                <ToolButton
                  visible={showSelectedShapeActions}
                  type="button"
                  icon={palette}
                  aria-label={t("buttons.edit")}
                  onClick={() =>
                    setAppState(({ openedMenu }: any) => ({
                      openedMenu: openedMenu === "shape" ? null : "shape",
                    }))
                  }
                />
                {actionManager.renderAction("finalize")}
              </>
            ) : (
              <>
                <ToolButton
                  type="button"
                  icon={menu}
                  aria-label={t("buttons.menu")}
                  onClick={() =>
                    setAppState(({ openedMenu }: any) => ({
                      openedMenu: openedMenu === "canvas" ? null : "canvas",
                    }))
                  }
                />
                <ToolButton
                  visible={showSelectedShapeActions}
                  type="button"
                  icon={palette}
                  aria-label={t("buttons.edit")}
                  onClick={() =>
                    setAppState(({ openedMenu }: any) => ({
                      openedMenu: openedMenu === "shape" ? null : "shape",
                    }))
                  }
                />
                {actionManager.renderAction("deleteSelectedElements")}
                {appState.scrolledOutside && (
                  <button
                    className="scroll-back-to-content"
                    onClick={() => {
                      setAppState({ ...calculateScrollCenter(elements) });
                    }}
                  >
                    {t("buttons.scrollBackToContent")}
                  </button>
                )}
              </>
            )}
          </div>
        </footer>
      </>
    ) : (
      <>
        <FixedSideContainer side="top">
          <HintViewer
            elementType={appState.elementType}
            multiMode={appState.multiElement !== null}
            isResizing={appState.isResizing}
            elements={elements}
          />
          <div className="App-menu App-menu_top">
            <Stack.Col gap={4} align="end">
              <section
                className="App-right-menu"
                aria-labelledby="canvas-actions-title"
              >
                <h2 className="visually-hidden" id="canvas-actions-title">
                  {t("headings.canvasActions")}
                </h2>
                <Island padding={4}>
                  <Stack.Col gap={4}>
                    <Stack.Row justifyContent={"space-between"}>
                      {actionManager.renderAction("loadScene")}
                      {actionManager.renderAction("saveScene")}
                      {renderExportDialog()}
                      {actionManager.renderAction("clearCanvas")}
                    </Stack.Row>
                    {actionManager.renderAction("changeViewBackgroundColor")}
                  </Stack.Col>
                </Island>
              </section>
              {showSelectedShapeActions && (
                <section
                  className="App-right-menu"
                  aria-labelledby="selected-shape-title"
                >
                  <h2 className="visually-hidden" id="selected-shape-title">
                    {t("headings.selectedShapeActions")}
                  </h2>
                  <Island padding={4}>{renderSelectedShapeActions()}</Island>
                </section>
              )}
            </Stack.Col>
            <section aria-labelledby="shapes-title">
              <Stack.Col gap={4} align="start">
                <Stack.Row gap={1}>
                  <Island padding={1}>
                    <h2 className="visually-hidden" id="shapes-title">
                      {t("headings.shapes")}
                    </h2>
                    <Stack.Row gap={1}>{renderShapesSwitcher()}</Stack.Row>
                  </Island>
                  <LockIcon
                    checked={appState.elementLocked}
                    onChange={() => {
                      setAppState({
                        elementLocked: !appState.elementLocked,
                        elementType: appState.elementLocked
                          ? "selection"
                          : appState.elementType,
                      });
                    }}
                    title={t("toolBar.lock")}
                    isButton={isMobile}
                  />
                </Stack.Row>
              </Stack.Col>
            </section>
            <div />
          </div>
          <div className="App-menu App-menu_bottom">
            <Stack.Col gap={2}>
              <section aria-labelledby="canvas-zoom-actions-title">
                <h2 className="visually-hidden" id="canvas-zoom-actions-title">
                  {t("headings.canvasActions")}
                </h2>
                <Island padding={1}>{renderZoomActions()}</Island>
              </section>
            </Stack.Col>
          </div>
        </FixedSideContainer>
        <footer role="contentinfo">
          <LanguageList
            onChange={lng => {
              setLanguage(lng);
              setAppState({});
            }}
            languages={languages}
            currentLanguage={language}
            floating
          />
          {appState.scrolledOutside && (
            <button
              className="scroll-back-to-content"
              onClick={() => {
                setAppState({ ...calculateScrollCenter(elements) });
              }}
            >
              {t("buttons.scrollBackToContent")}
            </button>
          )}
        </footer>
      </>
    );
  },
  (prev, next) => {
    const getNecessaryObj = (appState: AppState): Partial<AppState> => {
      const {
        draggingElement,
        resizingElement,
        multiElement,
        editingElement,
        isResizing,
        cursorX,
        cursorY,
        ...ret
      } = appState;
      return ret;
    };
    const prevAppState = getNecessaryObj(prev.appState);
    const nextAppState = getNecessaryObj(next.appState);

    const keys = Object.keys(prevAppState) as (keyof Partial<AppState>)[];

    return (
      prev.language === next.language &&
      prev.elements === next.elements &&
      keys.every(k => prevAppState[k] === nextAppState[k])
    );
  },
);

export class App extends React.Component<any, AppState> {
  canvas: HTMLCanvasElement | null = null;
  rc: RoughCanvas | null = null;

  actionManager: ActionManager;
  canvasOnlyActions: Array<Action>;
  constructor(props: any) {
    super(props);
    this.actionManager = new ActionManager(
      this.syncActionResult,
      () => this.state,
      () => elements,
    );
    this.actionManager.registerAction(actionFinalize);
    this.actionManager.registerAction(actionDeleteSelected);
    this.actionManager.registerAction(actionSendToBack);
    this.actionManager.registerAction(actionBringToFront);
    this.actionManager.registerAction(actionSendBackward);
    this.actionManager.registerAction(actionBringForward);
    this.actionManager.registerAction(actionSelectAll);

    this.actionManager.registerAction(actionChangeStrokeColor);
    this.actionManager.registerAction(actionChangeBackgroundColor);
    this.actionManager.registerAction(actionChangeFillStyle);
    this.actionManager.registerAction(actionChangeStrokeWidth);
    this.actionManager.registerAction(actionChangeOpacity);
    this.actionManager.registerAction(actionChangeSloppiness);
    this.actionManager.registerAction(actionChangeFontSize);
    this.actionManager.registerAction(actionChangeFontFamily);

    this.actionManager.registerAction(actionChangeViewBackgroundColor);
    this.actionManager.registerAction(actionClearCanvas);
    this.actionManager.registerAction(actionZoomIn);
    this.actionManager.registerAction(actionZoomOut);
    this.actionManager.registerAction(actionResetZoom);

    this.actionManager.registerAction(actionChangeProjectName);
    this.actionManager.registerAction(actionChangeExportBackground);
    this.actionManager.registerAction(actionSaveScene);
    this.actionManager.registerAction(actionLoadScene);

    this.actionManager.registerAction(actionCopyStyles);
    this.actionManager.registerAction(actionPasteStyles);

    this.canvasOnlyActions = [actionSelectAll];
  }

  private syncActionResult = (
    res: ActionResult,
    commitToHistory: boolean = true,
  ) => {
    if (this.unmounted) {
      return;
    }
    if (res.elements) {
      elements = res.elements;
      if (commitToHistory) {
        history.resumeRecording();
      }
      this.setState({});
    }

    if (res.appState) {
      if (commitToHistory) {
        history.resumeRecording();
      }
      this.setState({ ...res.appState });
    }
  };

  private onCut = (event: ClipboardEvent) => {
    if (isWritableElement(event.target)) {
      return;
    }
    copyToAppClipboard(elements);
    elements = deleteSelectedElements(elements);
    history.resumeRecording();
    this.setState({});
    event.preventDefault();
  };
  private onCopy = (event: ClipboardEvent) => {
    if (isWritableElement(event.target)) {
      return;
    }
    copyToAppClipboard(elements);
    event.preventDefault();
  };

  private onUnload = () => {
    isHoldingSpace = false;
    this.saveDebounced();
    this.saveDebounced.flush();
  };

  private disableEvent: EventHandlerNonNull = event => {
    event.preventDefault();
  };

  private unmounted = false;
  public async componentDidMount() {
    document.addEventListener("copy", this.onCopy);
    document.addEventListener("paste", this.pasteFromClipboard);
    document.addEventListener("cut", this.onCut);

    document.addEventListener("keydown", this.onKeyDown, false);
    document.addEventListener("keyup", this.onKeyUp, { passive: true });
    document.addEventListener("mousemove", this.updateCurrentCursorPosition);
    window.addEventListener("resize", this.onResize, false);
    window.addEventListener("unload", this.onUnload, false);
    window.addEventListener("blur", this.onUnload, false);
    window.addEventListener("dragover", this.disableEvent, false);
    window.addEventListener("drop", this.disableEvent, false);

    const searchParams = new URLSearchParams(window.location.search);
    const id = searchParams.get("id");

    if (id) {
      // Backwards compatibility with legacy url format
      const scene = await loadScene(id);
      this.syncActionResult(scene);
    } else {
      const match = window.location.hash.match(
        /^#json=([0-9]+),([a-zA-Z0-9_-]+)$/,
      );
      if (match) {
        const scene = await loadScene(match[1], match[2]);
        this.syncActionResult(scene);
      } else {
        const scene = await loadScene(null);
        this.syncActionResult(scene);
      }
    }
  }

  public componentWillUnmount() {
    this.unmounted = true;
    document.removeEventListener("copy", this.onCopy);
    document.removeEventListener("paste", this.pasteFromClipboard);
    document.removeEventListener("cut", this.onCut);

    document.removeEventListener("keydown", this.onKeyDown, false);
    document.removeEventListener(
      "mousemove",
      this.updateCurrentCursorPosition,
      false,
    );
    document.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.onResize, false);
    window.removeEventListener("unload", this.onUnload, false);
    window.removeEventListener("blur", this.onUnload, false);
    window.removeEventListener("dragover", this.disableEvent, false);
    window.removeEventListener("drop", this.disableEvent, false);
  }

  public state: AppState = getDefaultAppState();

  private onResize = () => {
    elements = elements.map(el => ({ ...el, shape: null }));
    this.setState({});
  };

  private updateCurrentCursorPosition = (event: MouseEvent) => {
    cursorX = event.x;
    cursorY = event.y;
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (
      (isWritableElement(event.target) && event.key !== KEYS.ESCAPE) ||
      // case: using arrows to move between buttons
      (isArrowKey(event.key) && isInputLike(event.target))
    ) {
      return;
    }

    if (this.actionManager.handleKeyDown(event)) {
      return;
    }

    const shape = findShapeByKey(event.key);

    if (isArrowKey(event.key)) {
      const step = event.shiftKey
        ? ELEMENT_SHIFT_TRANSLATE_AMOUNT
        : ELEMENT_TRANSLATE_AMOUNT;
      elements = elements.map(el => {
        if (el.isSelected) {
          const element = { ...el };
          if (event.key === KEYS.ARROW_LEFT) {
            element.x -= step;
          } else if (event.key === KEYS.ARROW_RIGHT) {
            element.x += step;
          } else if (event.key === KEYS.ARROW_UP) {
            element.y -= step;
          } else if (event.key === KEYS.ARROW_DOWN) {
            element.y += step;
          }
          return element;
        }
        return el;
      });
      this.setState({});
      event.preventDefault();
    } else if (
      shapesShortcutKeys.includes(event.key.toLowerCase()) &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      this.state.draggingElement === null
    ) {
      this.selectShapeTool(shape);
      // Undo action
    } else if (event[KEYS.META] && /z/i.test(event.key)) {
      event.preventDefault();

      if (
        this.state.multiElement ||
        this.state.resizingElement ||
        this.state.editingElement ||
        this.state.draggingElement
      ) {
        return;
      }

      if (event.shiftKey) {
        // Redo action
        const data = history.redoOnce();
        if (data !== null) {
          elements = data.elements;
          this.setState({ ...data.appState });
        }
      } else {
        // undo action
        const data = history.undoOnce();
        if (data !== null) {
          elements = data.elements;
          this.setState({ ...data.appState });
        }
      }
    } else if (event.key === KEYS.SPACE && gesture.pointers.length === 0) {
      isHoldingSpace = true;
      document.documentElement.style.cursor = CURSOR_TYPE.GRABBING;
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    if (event.key === KEYS.SPACE) {
      if (this.state.elementType === "selection") {
        resetCursor();
      } else {
        elements = clearSelection(elements);
        document.documentElement.style.cursor =
          this.state.elementType === "text"
            ? CURSOR_TYPE.TEXT
            : CURSOR_TYPE.CROSSHAIR;
        this.setState({});
      }
      isHoldingSpace = false;
    }
  };

  private copyToAppClipboard = () => {
    copyToAppClipboard(elements);
  };

  private pasteFromClipboard = async (event: ClipboardEvent | null) => {
    // #686
    const target = document.activeElement;
    const elementUnderCursor = document.elementFromPoint(cursorX, cursorY);
    if (
      // if no ClipboardEvent supplied, assume we're pasting via contextMenu
      //  thus these checks don't make sense
      !event ||
      (elementUnderCursor instanceof HTMLCanvasElement &&
        !isWritableElement(target))
    ) {
      const data = await getClipboardContent(event);
      if (data.elements) {
        this.addElementsFromPaste(data.elements);
      } else if (data.text) {
        const { x, y } = viewportCoordsToSceneCoords(
          { clientX: cursorX, clientY: cursorY },
          this.state,
          this.canvas,
        );

        const element = newTextElement(
          newElement(
            "text",
            x,
            y,
            this.state.currentItemStrokeColor,
            this.state.currentItemBackgroundColor,
            this.state.currentItemFillStyle,
            this.state.currentItemStrokeWidth,
            this.state.currentItemRoughness,
            this.state.currentItemOpacity,
          ),
          data.text,
          this.state.currentItemFont,
        );

        element.isSelected = true;

        elements = [...clearSelection(elements), element];
        history.resumeRecording();
      }
      this.selectShapeTool("selection");
      event?.preventDefault();
    }
  };

  private selectShapeTool(elementType: AppState["elementType"]) {
    if (!isHoldingSpace) {
      setCursorForShape(elementType);
    }
    if (isToolIcon(document.activeElement)) {
      document.activeElement.blur();
    }
    if (elementType !== "selection") {
      elements = clearSelection(elements);
    }
    this.setState({ elementType });
  }

  setAppState = (obj: any) => {
    this.setState(obj);
  };

  setElements = (elements_: readonly ExcalidrawElement[]) => {
    elements = elements_;
    this.setState({});
  };

  removePointer = (event: React.PointerEvent<HTMLElement>) => {
    gesture.pointers = gesture.pointers.filter(
      pointer => pointer.id !== event.pointerId,
    );
  };

  public render() {
    const canvasDOMWidth = window.innerWidth;
    const canvasDOMHeight = window.innerHeight;

    const canvasScale = window.devicePixelRatio;

    const canvasWidth = canvasDOMWidth * canvasScale;
    const canvasHeight = canvasDOMHeight * canvasScale;

    return (
      <div className="container">
        <LayerUI
          canvas={this.canvas}
          appState={this.state}
          setAppState={this.setAppState}
          actionManager={this.actionManager}
          elements={elements}
          setElements={this.setElements}
          language={getLanguage()}
        />
        <main>
          <canvas
            id="canvas"
            style={{
              width: canvasDOMWidth,
              height: canvasDOMHeight,
            }}
            width={canvasWidth}
            height={canvasHeight}
            ref={canvas => {
              // canvas is null when unmounting
              if (canvas !== null) {
                this.canvas = canvas;
                this.rc = rough.canvas(this.canvas);

                this.canvas.addEventListener("wheel", this.handleWheel, {
                  passive: false,
                });

                this.canvas
                  .getContext("2d")
                  ?.setTransform(canvasScale, 0, 0, canvasScale, 0, 0);
              } else {
                this.canvas?.removeEventListener("wheel", this.handleWheel);
              }
            }}
            onContextMenu={event => {
              event.preventDefault();

              const { x, y } = viewportCoordsToSceneCoords(
                event,
                this.state,
                this.canvas,
              );

              const element = getElementAtPosition(
                elements,
                x,
                y,
                this.state.zoom,
              );
              if (!element) {
                ContextMenu.push({
                  options: [
                    navigator.clipboard && {
                      label: t("labels.paste"),
                      action: () => this.pasteFromClipboard(null),
                    },
                    ...this.actionManager.getContextMenuItems(action =>
                      this.canvasOnlyActions.includes(action),
                    ),
                  ],
                  top: event.clientY,
                  left: event.clientX,
                });
                return;
              }

              if (!element.isSelected) {
                elements = clearSelection(elements);
                element.isSelected = true;
                this.setState({});
              }

              ContextMenu.push({
                options: [
                  navigator.clipboard && {
                    label: t("labels.copy"),
                    action: this.copyToAppClipboard,
                  },
                  navigator.clipboard && {
                    label: t("labels.paste"),
                    action: () => this.pasteFromClipboard(null),
                  },
                  ...this.actionManager.getContextMenuItems(
                    action => !this.canvasOnlyActions.includes(action),
                  ),
                ],
                top: event.clientY,
                left: event.clientX,
              });
            }}
            onPointerDown={event => {
              if (lastPointerUp !== null) {
                // Unfortunately, sometimes we don't get a pointerup after a pointerdown,
                // this can happen when a contextual menu or alert is triggered. In order to avoid
                // being in a weird state, we clean up on the next pointerdown
                lastPointerUp(event);
              }

              if (isPanning) {
                return;
              }

              this.setState({ lastPointerDownWith: event.pointerType });

              // pan canvas on wheel button drag or space+drag
              if (
                gesture.pointers.length === 0 &&
                (event.button === POINTER_BUTTON.WHEEL ||
                  (event.button === POINTER_BUTTON.MAIN && isHoldingSpace))
              ) {
                isPanning = true;
                document.documentElement.style.cursor = CURSOR_TYPE.GRABBING;
                let { clientX: lastX, clientY: lastY } = event;
                const onPointerMove = (event: PointerEvent) => {
                  const deltaX = lastX - event.clientX;
                  const deltaY = lastY - event.clientY;
                  lastX = event.clientX;
                  lastY = event.clientY;

                  this.setState({
                    scrollX: normalizeScroll(
                      this.state.scrollX - deltaX / this.state.zoom,
                    ),
                    scrollY: normalizeScroll(
                      this.state.scrollY - deltaY / this.state.zoom,
                    ),
                  });
                };
                const teardown = (lastPointerUp = () => {
                  lastPointerUp = null;
                  isPanning = false;
                  if (!isHoldingSpace) {
                    setCursorForShape(this.state.elementType);
                  }
                  window.removeEventListener("pointermove", onPointerMove);
                  window.removeEventListener("pointerup", teardown);
                  window.removeEventListener("blur", teardown);
                });
                window.addEventListener("blur", teardown);
                window.addEventListener("pointermove", onPointerMove, {
                  passive: true,
                });
                window.addEventListener("pointerup", teardown);
                return;
              }

              // only handle left mouse button or touch
              if (
                event.button !== POINTER_BUTTON.MAIN &&
                event.button !== POINTER_BUTTON.TOUCH
              ) {
                return;
              }

              gesture.pointers.push({
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
              });
              if (gesture.pointers.length === 2) {
                gesture.lastCenter = getCenter(gesture.pointers);
                gesture.initialScale = this.state.zoom;
                gesture.initialDistance = getDistance(gesture.pointers);
              }

              // fixes pointermove causing selection of UI texts #32
              event.preventDefault();
              // Preventing the event above disables default behavior
              //  of defocusing potentially focused element, which is what we
              //  want when clicking inside the canvas.
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }

              // don't select while panning
              if (gesture.pointers.length > 1) {
                return;
              }

              // Handle scrollbars dragging
              const {
                isOverHorizontalScrollBar,
                isOverVerticalScrollBar,
              } = isOverScrollBars(
                elements,
                event.clientX / window.devicePixelRatio,
                event.clientY / window.devicePixelRatio,
                canvasWidth / window.devicePixelRatio,
                canvasHeight / window.devicePixelRatio,
                this.state,
              );

              const { x, y } = viewportCoordsToSceneCoords(
                event,
                this.state,
                this.canvas,
              );

              const originX = x;
              const originY = y;

              let element = newElement(
                this.state.elementType,
                x,
                y,
                this.state.currentItemStrokeColor,
                this.state.currentItemBackgroundColor,
                this.state.currentItemFillStyle,
                this.state.currentItemStrokeWidth,
                this.state.currentItemRoughness,
                this.state.currentItemOpacity,
              );

              if (isTextElement(element)) {
                element = newTextElement(
                  element,
                  "",
                  this.state.currentItemFont,
                );
              }

              type ResizeTestType = ReturnType<typeof resizeTest>;
              let resizeHandle: ResizeTestType = false;
              let isResizingElements = false;
              let draggingOccurred = false;
              let hitElement: ExcalidrawElement | null = null;
              let elementIsAddedToSelection = false;
              if (this.state.elementType === "selection") {
                const resizeElement = getElementWithResizeHandler(
                  elements,
                  { x, y },
                  this.state.zoom,
                  event.pointerType,
                );

                const selectedElements = getSelectedElements(elements);
                if (selectedElements.length === 1 && resizeElement) {
                  this.setState({
                    resizingElement: resizeElement
                      ? resizeElement.element
                      : null,
                  });

                  resizeHandle = resizeElement.resizeHandle;
                  document.documentElement.style.cursor = getCursorForResizingElement(
                    resizeElement,
                  );
                  isResizingElements = true;
                } else {
                  hitElement = getElementAtPosition(
                    elements,
                    x,
                    y,
                    this.state.zoom,
                  );
                  // clear selection if shift is not clicked
                  if (!hitElement?.isSelected && !event.shiftKey) {
                    elements = clearSelection(elements);
                  }

                  // If we click on something
                  if (hitElement) {
                    // deselect if item is selected
                    // if shift is not clicked, this will always return true
                    // otherwise, it will trigger selection based on current
                    // state of the box
                    if (!hitElement.isSelected) {
                      hitElement.isSelected = true;
                      elements = elements.slice();
                      elementIsAddedToSelection = true;
                    }

                    // We duplicate the selected element if alt is pressed on pointer down
                    if (event.altKey) {
                      elements = [
                        ...elements.map(element => ({
                          ...element,
                          isSelected: false,
                        })),
                        ...getSelectedElements(elements).map(element => {
                          const newElement = duplicateElement(element);
                          newElement.isSelected = true;
                          return newElement;
                        }),
                      ];
                    }
                  }
                }
              } else {
                elements = clearSelection(elements);
              }

              if (isTextElement(element)) {
                // if we're currently still editing text, clicking outside
                //  should only finalize it, not create another (irrespective
                //  of state.elementLocked)
                if (this.state.editingElement?.type === "text") {
                  return;
                }
                if (elementIsAddedToSelection) {
                  element = hitElement!;
                }
                let textX = event.clientX;
                let textY = event.clientY;
                if (!event.altKey) {
                  const snappedToCenterPosition = this.getTextWysiwygSnappedToCenterPosition(
                    x,
                    y,
                  );
                  if (snappedToCenterPosition) {
                    element.x = snappedToCenterPosition.elementCenterX;
                    element.y = snappedToCenterPosition.elementCenterY;
                    textX = snappedToCenterPosition.wysiwygX;
                    textY = snappedToCenterPosition.wysiwygY;
                  }
                }

                const resetSelection = () => {
                  this.setState({
                    draggingElement: null,
                    editingElement: null,
                  });
                };

                textWysiwyg({
                  initText: "",
                  x: textX,
                  y: textY,
                  strokeColor: this.state.currentItemStrokeColor,
                  opacity: this.state.currentItemOpacity,
                  font: this.state.currentItemFont,
                  zoom: this.state.zoom,
                  onSubmit: text => {
                    if (text) {
                      elements = [
                        ...elements,
                        {
                          ...newTextElement(
                            element,
                            text,
                            this.state.currentItemFont,
                          ),
                          isSelected: true,
                        },
                      ];
                    }
                    if (this.state.elementLocked) {
                      setCursorForShape(this.state.elementType);
                    }
                    history.resumeRecording();
                    resetSelection();
                  },
                  onCancel: () => {
                    resetSelection();
                  },
                });
                resetCursor();
                if (!this.state.elementLocked) {
                  this.setState({
                    editingElement: element,
                    elementType: "selection",
                  });
                } else {
                  this.setState({
                    editingElement: element,
                  });
                }
                return;
              } else if (
                this.state.elementType === "arrow" ||
                this.state.elementType === "line"
              ) {
                if (this.state.multiElement) {
                  const { multiElement } = this.state;
                  const { x: rx, y: ry } = multiElement;
                  //force LayerUI rerender
                  elements = elements.slice();
                  multiElement.points.push([x - rx, y - ry]);
                  multiElement.shape = null;
                } else {
                  element.isSelected = false;
                  element.points.push([0, 0]);
                  element.shape = null;
                  elements = [...elements, element];
                  this.setState({
                    draggingElement: element,
                  });
                }
              } else if (element.type === "selection") {
                this.setState({
                  selectionElement: element,
                  draggingElement: element,
                });
              } else {
                elements = [...elements, element];
                this.setState({ multiElement: null, draggingElement: element });
              }

              let lastX = x;
              let lastY = y;

              if (isOverHorizontalScrollBar || isOverVerticalScrollBar) {
                lastX = event.clientX;
                lastY = event.clientY;
              }

              let resizeArrowFn:
                | ((
                    element: ExcalidrawElement,
                    p1: Point,
                    deltaX: number,
                    deltaY: number,
                    pointerX: number,
                    pointerY: number,
                    perfect: boolean,
                  ) => void)
                | null = null;

              const arrowResizeOrigin = (
                element: ExcalidrawElement,
                p1: Point,
                deltaX: number,
                deltaY: number,
                pointerX: number,
                pointerY: number,
                perfect: boolean,
              ) => {
                if (perfect) {
                  const absPx = p1[0] + element.x;
                  const absPy = p1[1] + element.y;

                  const { width, height } = getPerfectElementSize(
                    element.type,
                    pointerX - element.x - p1[0],
                    pointerY - element.y - p1[1],
                  );

                  const dx = element.x + width + p1[0];
                  const dy = element.y + height + p1[1];
                  element.x = dx;
                  element.y = dy;
                  p1[0] = absPx - element.x;
                  p1[1] = absPy - element.y;
                } else {
                  element.x += deltaX;
                  element.y += deltaY;
                  p1[0] -= deltaX;
                  p1[1] -= deltaY;
                }
              };

              const arrowResizeEnd = (
                element: ExcalidrawElement,
                p1: Point,
                deltaX: number,
                deltaY: number,
                pointerX: number,
                pointerY: number,
                perfect: boolean,
              ) => {
                if (perfect) {
                  const { width, height } = getPerfectElementSize(
                    element.type,
                    pointerX - element.x,
                    pointerY - element.y,
                  );
                  p1[0] = width;
                  p1[1] = height;
                } else {
                  p1[0] += deltaX;
                  p1[1] += deltaY;
                }
              };

              const onPointerMove = (event: PointerEvent) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) {
                  return;
                }

                if (isOverHorizontalScrollBar) {
                  const x = event.clientX;
                  const dx = x - lastX;
                  this.setState({
                    scrollX: normalizeScroll(
                      this.state.scrollX - dx / this.state.zoom,
                    ),
                  });
                  lastX = x;
                  return;
                }

                if (isOverVerticalScrollBar) {
                  const y = event.clientY;
                  const dy = y - lastY;
                  this.setState({
                    scrollY: normalizeScroll(
                      this.state.scrollY - dy / this.state.zoom,
                    ),
                  });
                  lastY = y;
                  return;
                }

                // for arrows, don't start dragging until a given threshold
                //  to ensure we don't create a 2-point arrow by mistake when
                //  user clicks mouse in a way that it moves a tiny bit (thus
                //  triggering pointermove)
                if (
                  !draggingOccurred &&
                  (this.state.elementType === "arrow" ||
                    this.state.elementType === "line")
                ) {
                  const { x, y } = viewportCoordsToSceneCoords(
                    event,
                    this.state,
                    this.canvas,
                  );
                  if (distance2d(x, y, originX, originY) < DRAGGING_THRESHOLD) {
                    return;
                  }
                }

                if (isResizingElements && this.state.resizingElement) {
                  this.setState({ isResizing: true });
                  const el = this.state.resizingElement;
                  const selectedElements = getSelectedElements(elements);
                  if (selectedElements.length === 1) {
                    const { x, y } = viewportCoordsToSceneCoords(
                      event,
                      this.state,
                      this.canvas,
                    );
                    const deltaX = x - lastX;
                    const deltaY = y - lastY;
                    const element = selectedElements[0];
                    const isLinear =
                      element.type === "line" || element.type === "arrow";
                    switch (resizeHandle) {
                      case "nw":
                        if (isLinear && element.points.length === 2) {
                          const [, p1] = element.points;

                          if (!resizeArrowFn) {
                            if (p1[0] < 0 || p1[1] < 0) {
                              resizeArrowFn = arrowResizeEnd;
                            } else {
                              resizeArrowFn = arrowResizeOrigin;
                            }
                          }
                          resizeArrowFn(
                            element,
                            p1,
                            deltaX,
                            deltaY,
                            x,
                            y,
                            event.shiftKey,
                          );
                        } else {
                          element.width -= deltaX;
                          element.x += deltaX;

                          if (event.shiftKey) {
                            element.y += element.height - element.width;
                            element.height = element.width;
                          } else {
                            element.height -= deltaY;
                            element.y += deltaY;
                          }
                        }
                        break;
                      case "ne":
                        if (isLinear && element.points.length === 2) {
                          const [, p1] = element.points;
                          if (!resizeArrowFn) {
                            if (p1[0] >= 0) {
                              resizeArrowFn = arrowResizeEnd;
                            } else {
                              resizeArrowFn = arrowResizeOrigin;
                            }
                          }
                          resizeArrowFn(
                            element,
                            p1,
                            deltaX,
                            deltaY,
                            x,
                            y,
                            event.shiftKey,
                          );
                        } else {
                          element.width += deltaX;
                          if (event.shiftKey) {
                            element.y += element.height - element.width;
                            element.height = element.width;
                          } else {
                            element.height -= deltaY;
                            element.y += deltaY;
                          }
                        }
                        break;
                      case "sw":
                        if (isLinear && element.points.length === 2) {
                          const [, p1] = element.points;
                          if (!resizeArrowFn) {
                            if (p1[0] <= 0) {
                              resizeArrowFn = arrowResizeEnd;
                            } else {
                              resizeArrowFn = arrowResizeOrigin;
                            }
                          }
                          resizeArrowFn(
                            element,
                            p1,
                            deltaX,
                            deltaY,
                            x,
                            y,
                            event.shiftKey,
                          );
                        } else {
                          element.width -= deltaX;
                          element.x += deltaX;
                          if (event.shiftKey) {
                            element.height = element.width;
                          } else {
                            element.height += deltaY;
                          }
                        }
                        break;
                      case "se":
                        if (isLinear && element.points.length === 2) {
                          const [, p1] = element.points;
                          if (!resizeArrowFn) {
                            if (p1[0] > 0 || p1[1] > 0) {
                              resizeArrowFn = arrowResizeEnd;
                            } else {
                              resizeArrowFn = arrowResizeOrigin;
                            }
                          }
                          resizeArrowFn(
                            element,
                            p1,
                            deltaX,
                            deltaY,
                            x,
                            y,
                            event.shiftKey,
                          );
                        } else {
                          if (event.shiftKey) {
                            element.width += deltaX;
                            element.height = element.width;
                          } else {
                            element.width += deltaX;
                            element.height += deltaY;
                          }
                        }
                        break;
                      case "n": {
                        element.height -= deltaY;
                        element.y += deltaY;

                        if (element.points.length > 0) {
                          const len = element.points.length;

                          const points = [...element.points].sort(
                            (a, b) => a[1] - b[1],
                          );

                          for (let i = 1; i < points.length; ++i) {
                            const pnt = points[i];
                            pnt[1] -= deltaY / (len - i);
                          }
                        }
                        break;
                      }
                      case "w": {
                        element.width -= deltaX;
                        element.x += deltaX;

                        if (element.points.length > 0) {
                          const len = element.points.length;
                          const points = [...element.points].sort(
                            (a, b) => a[0] - b[0],
                          );

                          for (let i = 0; i < points.length; ++i) {
                            const pnt = points[i];
                            pnt[0] -= deltaX / (len - i);
                          }
                        }
                        break;
                      }
                      case "s": {
                        element.height += deltaY;
                        if (element.points.length > 0) {
                          const len = element.points.length;
                          const points = [...element.points].sort(
                            (a, b) => a[1] - b[1],
                          );

                          for (let i = 1; i < points.length; ++i) {
                            const pnt = points[i];
                            pnt[1] += deltaY / (len - i);
                          }
                        }
                        break;
                      }
                      case "e": {
                        element.width += deltaX;
                        if (element.points.length > 0) {
                          const len = element.points.length;
                          const points = [...element.points].sort(
                            (a, b) => a[0] - b[0],
                          );

                          for (let i = 1; i < points.length; ++i) {
                            const pnt = points[i];
                            pnt[0] += deltaX / (len - i);
                          }
                        }
                        break;
                      }
                    }

                    if (resizeHandle) {
                      resizeHandle = normalizeResizeHandle(
                        element,
                        resizeHandle,
                      );
                    }
                    normalizeDimensions(element);

                    document.documentElement.style.cursor = getCursorForResizingElement(
                      { element, resizeHandle },
                    );
                    el.x = element.x;
                    el.y = element.y;
                    el.shape = null;

                    lastX = x;
                    lastY = y;
                    this.setState({});
                    return;
                  }
                }

                if (hitElement?.isSelected) {
                  // Marking that click was used for dragging to check
                  // if elements should be deselected on pointerup
                  draggingOccurred = true;
                  const selectedElements = getSelectedElements(elements);
                  if (selectedElements.length > 0) {
                    const { x, y } = viewportCoordsToSceneCoords(
                      event,
                      this.state,
                      this.canvas,
                    );

                    selectedElements.forEach(element => {
                      element.x += x - lastX;
                      element.y += y - lastY;
                    });
                    lastX = x;
                    lastY = y;
                    this.setState({});
                    return;
                  }
                }

                // It is very important to read this.state within each move event,
                // otherwise we would read a stale one!
                const draggingElement = this.state.draggingElement;
                if (!draggingElement) {
                  return;
                }

                const { x, y } = viewportCoordsToSceneCoords(
                  event,
                  this.state,
                  this.canvas,
                );

                let width = distance(originX, x);
                let height = distance(originY, y);

                const isLinear =
                  this.state.elementType === "line" ||
                  this.state.elementType === "arrow";

                if (isLinear) {
                  draggingOccurred = true;
                  const points = draggingElement.points;
                  let dx = x - draggingElement.x;
                  let dy = y - draggingElement.y;

                  if (event.shiftKey && points.length === 2) {
                    ({ width: dx, height: dy } = getPerfectElementSize(
                      this.state.elementType,
                      dx,
                      dy,
                    ));
                  }

                  if (points.length === 1) {
                    points.push([dx, dy]);
                  } else if (points.length > 1) {
                    const pnt = points[points.length - 1];
                    pnt[0] = dx;
                    pnt[1] = dy;
                  }
                } else {
                  if (event.shiftKey) {
                    ({ width, height } = getPerfectElementSize(
                      this.state.elementType,
                      width,
                      y < originY ? -height : height,
                    ));

                    if (height < 0) {
                      height = -height;
                    }
                  }

                  draggingElement.x = x < originX ? originX - width : originX;
                  draggingElement.y = y < originY ? originY - height : originY;

                  draggingElement.width = width;
                  draggingElement.height = height;
                }

                draggingElement.shape = null;

                if (this.state.elementType === "selection") {
                  if (!event.shiftKey && isSomeElementSelected(elements)) {
                    elements = clearSelection(elements);
                  }
                  const elementsWithinSelection = getElementsWithinSelection(
                    elements,
                    draggingElement,
                  );
                  elementsWithinSelection.forEach(element => {
                    element.isSelected = true;
                  });
                }
                this.setState({});
              };

              const onPointerUp = (event: PointerEvent) => {
                const {
                  draggingElement,
                  resizingElement,
                  multiElement,
                  elementType,
                  elementLocked,
                } = this.state;

                this.setState({
                  isResizing: false,
                  resizingElement: null,
                  selectionElement: null,
                });

                resizeArrowFn = null;
                lastPointerUp = null;
                window.removeEventListener("pointermove", onPointerMove);
                window.removeEventListener("pointerup", onPointerUp);

                if (elementType === "arrow" || elementType === "line") {
                  if (draggingElement!.points.length > 1) {
                    history.resumeRecording();
                    this.setState({});
                  }
                  if (!draggingOccurred && draggingElement && !multiElement) {
                    const { x, y } = viewportCoordsToSceneCoords(
                      event,
                      this.state,
                      this.canvas,
                    );
                    draggingElement.points.push([
                      x - draggingElement.x,
                      y - draggingElement.y,
                    ]);
                    draggingElement.shape = null;
                    this.setState({ multiElement: this.state.draggingElement });
                  } else if (draggingOccurred && !multiElement) {
                    this.state.draggingElement!.isSelected = true;
                    if (!elementLocked) {
                      resetCursor();
                      this.setState({
                        draggingElement: null,
                        elementType: "selection",
                      });
                    } else {
                      this.setState({
                        draggingElement: null,
                      });
                    }
                  }
                  return;
                }

                if (
                  elementType !== "selection" &&
                  draggingElement &&
                  isInvisiblySmallElement(draggingElement)
                ) {
                  // remove invisible element which was added in onPointerDown
                  elements = elements.slice(0, -1);
                  this.setState({
                    draggingElement: null,
                  });
                  return;
                }

                if (normalizeDimensions(draggingElement)) {
                  this.setState({});
                }

                if (resizingElement) {
                  history.resumeRecording();
                  this.setState({});
                }

                if (
                  resizingElement &&
                  isInvisiblySmallElement(resizingElement)
                ) {
                  elements = elements.filter(
                    el => el.id !== resizingElement.id,
                  );
                }

                // If click occurred on already selected element
                // it is needed to remove selection from other elements
                // or if SHIFT or META key pressed remove selection
                // from hitted element
                //
                // If click occurred and elements were dragged or some element
                // was added to selection (on pointerdown phase) we need to keep
                // selection unchanged
                if (
                  hitElement &&
                  !draggingOccurred &&
                  !elementIsAddedToSelection
                ) {
                  if (event.shiftKey) {
                    hitElement.isSelected = false;
                  } else {
                    elements = clearSelection(elements);
                    hitElement.isSelected = true;
                  }
                }

                if (draggingElement === null) {
                  // if no element is clicked, clear the selection and redraw
                  elements = clearSelection(elements);
                  this.setState({});
                  return;
                }

                if (!elementLocked) {
                  draggingElement.isSelected = true;
                }

                if (
                  elementType !== "selection" ||
                  isSomeElementSelected(elements)
                ) {
                  history.resumeRecording();
                }

                if (!elementLocked) {
                  resetCursor();
                  this.setState({
                    draggingElement: null,
                    elementType: "selection",
                  });
                } else {
                  this.setState({
                    draggingElement: null,
                  });
                }
              };

              lastPointerUp = onPointerUp;

              window.addEventListener("pointermove", onPointerMove);
              window.addEventListener("pointerup", onPointerUp);
            }}
            onDoubleClick={event => {
              resetCursor();

              const { x, y } = viewportCoordsToSceneCoords(
                event,
                this.state,
                this.canvas,
              );

              const elementAtPosition = getElementAtPosition(
                elements,
                x,
                y,
                this.state.zoom,
              );

              const element =
                elementAtPosition && isTextElement(elementAtPosition)
                  ? elementAtPosition
                  : newTextElement(
                      newElement(
                        "text",
                        x,
                        y,
                        this.state.currentItemStrokeColor,
                        this.state.currentItemBackgroundColor,
                        this.state.currentItemFillStyle,
                        this.state.currentItemStrokeWidth,
                        this.state.currentItemRoughness,
                        this.state.currentItemOpacity,
                      ),
                      "", // default text
                      this.state.currentItemFont, // default font
                    );

              this.setState({ editingElement: element });

              let textX = event.clientX;
              let textY = event.clientY;

              if (elementAtPosition && isTextElement(elementAtPosition)) {
                elements = elements.filter(
                  element => element.id !== elementAtPosition.id,
                );
                this.setState({});

                const centerElementX =
                  elementAtPosition.x + elementAtPosition.width / 2;
                const centerElementY =
                  elementAtPosition.y + elementAtPosition.height / 2;

                const {
                  x: centerElementXInViewport,
                  y: centerElementYInViewport,
                } = sceneCoordsToViewportCoords(
                  { sceneX: centerElementX, sceneY: centerElementY },
                  this.state,
                  this.canvas,
                );

                textX = centerElementXInViewport;
                textY = centerElementYInViewport;

                // x and y will change after calling newTextElement function
                element.x = centerElementX;
                element.y = centerElementY;
              } else if (!event.altKey) {
                const snappedToCenterPosition = this.getTextWysiwygSnappedToCenterPosition(
                  x,
                  y,
                );

                if (snappedToCenterPosition) {
                  element.x = snappedToCenterPosition.elementCenterX;
                  element.y = snappedToCenterPosition.elementCenterY;
                  textX = snappedToCenterPosition.wysiwygX;
                  textY = snappedToCenterPosition.wysiwygY;
                }
              }

              const resetSelection = () => {
                this.setState({
                  draggingElement: null,
                  editingElement: null,
                });
              };

              textWysiwyg({
                initText: element.text,
                x: textX,
                y: textY,
                strokeColor: element.strokeColor,
                font: element.font,
                opacity: this.state.currentItemOpacity,
                zoom: this.state.zoom,
                onSubmit: text => {
                  if (text) {
                    elements = [
                      ...elements,
                      {
                        // we need to recreate the element to update dimensions &
                        //  position
                        ...newTextElement(element, text, element.font),
                        isSelected: true,
                      },
                    ];
                  }
                  history.resumeRecording();
                  resetSelection();
                },
                onCancel: () => {
                  resetSelection();
                },
              });
            }}
            onPointerMove={event => {
              gesture.pointers = gesture.pointers.map(pointer =>
                pointer.id === event.pointerId
                  ? {
                      id: event.pointerId,
                      x: event.clientX,
                      y: event.clientY,
                    }
                  : pointer,
              );

              if (gesture.pointers.length === 2) {
                const center = getCenter(gesture.pointers);
                const deltaX = center.x - gesture.lastCenter!.x;
                const deltaY = center.y - gesture.lastCenter!.y;
                gesture.lastCenter = center;

                const distance = getDistance(gesture.pointers);
                const scaleFactor = distance / gesture.initialDistance!;

                this.setState({
                  scrollX: normalizeScroll(
                    this.state.scrollX + deltaX / this.state.zoom,
                  ),
                  scrollY: normalizeScroll(
                    this.state.scrollY + deltaY / this.state.zoom,
                  ),
                  zoom: getNormalizedZoom(gesture.initialScale! * scaleFactor),
                });
              } else {
                gesture.lastCenter = gesture.initialDistance = gesture.initialScale = null;
              }

              if (isHoldingSpace || isPanning) {
                return;
              }
              const hasDeselectedButton = Boolean(event.buttons);

              const { x, y } = viewportCoordsToSceneCoords(
                event,
                this.state,
                this.canvas,
              );
              if (this.state.multiElement) {
                const { multiElement } = this.state;
                const originX = multiElement.x;
                const originY = multiElement.y;
                const points = multiElement.points;
                const pnt = points[points.length - 1];
                pnt[0] = x - originX;
                pnt[1] = y - originY;
                multiElement.shape = null;
                this.setState({});
                return;
              }

              if (
                hasDeselectedButton ||
                this.state.elementType !== "selection"
              ) {
                return;
              }

              const selectedElements = getSelectedElements(elements);
              if (selectedElements.length === 1) {
                const resizeElement = getElementWithResizeHandler(
                  elements,
                  { x, y },
                  this.state.zoom,
                  event.pointerType,
                );
                if (resizeElement && resizeElement.resizeHandle) {
                  document.documentElement.style.cursor = getCursorForResizingElement(
                    resizeElement,
                  );
                  return;
                }
              }
              const hitElement = getElementAtPosition(
                elements,
                x,
                y,
                this.state.zoom,
              );
              document.documentElement.style.cursor = hitElement ? "move" : "";
            }}
            onPointerUp={this.removePointer}
            onPointerLeave={this.removePointer}
            onDrop={event => {
              const file = event.dataTransfer.files[0];
              if (file?.type === "application/json") {
                loadFromBlob(file)
                  .then(({ elements, appState }) =>
                    this.syncActionResult({ elements, appState }),
                  )
                  .catch(error => console.error(error));
              }
            }}
          >
            {t("labels.drawingCanvas")}
          </canvas>
        </main>
      </div>
    );
  }

  private handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    const { deltaX, deltaY } = event;

    if (event[KEYS.META]) {
      const sign = Math.sign(deltaY);
      const MAX_STEP = 10;
      let delta = Math.abs(deltaY);
      if (delta > MAX_STEP) {
        delta = MAX_STEP;
      }
      delta *= sign;
      this.setState(({ zoom }) => ({
        zoom: getNormalizedZoom(zoom - delta / 100),
      }));
      return;
    }

    this.setState(({ zoom, scrollX, scrollY }) => ({
      scrollX: normalizeScroll(scrollX - deltaX / zoom),
      scrollY: normalizeScroll(scrollY - deltaY / zoom),
    }));
  };

  private addElementsFromPaste = (
    clipboardElements: readonly ExcalidrawElement[],
  ) => {
    elements = clearSelection(elements);

    const [minX, minY, maxX, maxY] = getCommonBounds(clipboardElements);

    const elementsCenterX = distance(minX, maxX) / 2;
    const elementsCenterY = distance(minY, maxY) / 2;

    const { x, y } = viewportCoordsToSceneCoords(
      { clientX: cursorX, clientY: cursorY },
      this.state,
      this.canvas,
    );

    const dx = x - elementsCenterX;
    const dy = y - elementsCenterY;

    elements = [
      ...elements,
      ...clipboardElements.map(clipboardElements => {
        const duplicate = duplicateElement(clipboardElements);
        duplicate.x += dx - minX;
        duplicate.y += dy - minY;
        return duplicate;
      }),
    ];
    history.resumeRecording();
    this.setState({});
  };

  private getTextWysiwygSnappedToCenterPosition(x: number, y: number) {
    const elementClickedInside = getElementContainingPosition(elements, x, y);
    if (elementClickedInside) {
      const elementCenterX =
        elementClickedInside.x + elementClickedInside.width / 2;
      const elementCenterY =
        elementClickedInside.y + elementClickedInside.height / 2;
      const distanceToCenter = Math.hypot(
        x - elementCenterX,
        y - elementCenterY,
      );
      const isSnappedToCenter =
        distanceToCenter < TEXT_TO_CENTER_SNAP_THRESHOLD;
      if (isSnappedToCenter) {
        const wysiwygX =
          this.state.scrollX +
          elementClickedInside.x +
          elementClickedInside.width / 2;
        const wysiwygY =
          this.state.scrollY +
          elementClickedInside.y +
          elementClickedInside.height / 2;
        return { wysiwygX, wysiwygY, elementCenterX, elementCenterY };
      }
    }
  }

  private saveDebounced = debounce(() => {
    saveToLocalStorage(elements, this.state);
  }, 300);

  componentDidUpdate() {
    const atLeastOneVisibleElement = renderScene(
      elements,
      this.state.selectionElement,
      this.rc!,
      this.canvas!,
      {
        scrollX: this.state.scrollX,
        scrollY: this.state.scrollY,
        viewBackgroundColor: this.state.viewBackgroundColor,
        zoom: this.state.zoom,
      },
      {
        renderOptimizations: true,
      },
    );
    const scrolledOutside = !atLeastOneVisibleElement && elements.length > 0;
    if (this.state.scrolledOutside !== scrolledOutside) {
      this.setState({ scrolledOutside: scrolledOutside });
    }
    this.saveDebounced();
    if (history.isRecording()) {
      history.pushEntry(this.state, elements);
      history.skipRecording();
    }
  }
}

const rootElement = document.getElementById("root");

interface TopErrorBoundaryState {
  unresolvedError: Error[] | null;
  hasError: boolean;
  stack: string;
  localStorage: string;
}

class TopErrorBoundary extends React.Component<any, TopErrorBoundaryState> {
  state: TopErrorBoundaryState = {
    unresolvedError: null,
    hasError: false,
    stack: "",
    localStorage: "",
  };

  componentDidCatch(error: Error) {
    const _localStorage: any = {};
    for (const [key, value] of Object.entries({ ...localStorage })) {
      try {
        _localStorage[key] = JSON.parse(value);
      } catch (error) {
        _localStorage[key] = value;
      }
    }
    this.setState(state => ({
      hasError: true,
      unresolvedError: state.unresolvedError
        ? state.unresolvedError.concat(error)
        : [error],
      localStorage: JSON.stringify(_localStorage),
    }));
  }

  async componentDidUpdate() {
    if (this.state.unresolvedError !== null) {
      let stack = "";
      for (const error of this.state.unresolvedError) {
        if (stack) {
          stack += `\n\n================\n\n`;
        }
        stack += `${error.message}:\n\n`;
        try {
          const StackTrace = await import("stacktrace-js");
          stack += (await StackTrace.fromError(error)).join("\n");
        } catch (error) {
          console.error(error);
          stack += error.stack || "";
        }
      }

      this.setState(state => ({
        unresolvedError: null,
        stack: `${
          state.stack ? `${state.stack}\n\n================\n\n${stack}` : stack
        }`,
      }));
    }
  }

  private selectTextArea(event: React.MouseEvent<HTMLTextAreaElement>) {
    if (event.target !== document.activeElement) {
      event.preventDefault();
      (event.target as HTMLTextAreaElement).select();
    }
  }

  private async createGithubIssue() {
    let body = "";
    try {
      const templateStr = (await import("./bug-issue-template")).default;
      if (typeof templateStr === "string") {
        body = encodeURIComponent(templateStr);
      }
    } catch {}

    window.open(
      `https://github.com/excalidraw/excalidraw/issues/new?body=${body}`,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="ErrorSplash">
          <div className="ErrorSplash-messageContainer">
            <div className="ErrorSplash-paragraph bigger">
              Encountered an error. Please{" "}
              <button onClick={() => window.location.reload()}>
                reload the page
              </button>
              .
            </div>
            <div className="ErrorSplash-paragraph">
              If reloading doesn't work. Try{" "}
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
              >
                clearing the canvas
              </button>
              .<br />
              <div className="smaller">
                (This will unfortunately result in loss of work.)
              </div>
            </div>
            <div>
              <div className="ErrorSplash-paragraph">
                Before doing so, we'd appreciate if you opened an issue on our{" "}
                <button onClick={this.createGithubIssue}>bug tracker</button>.
                Please include the following error stack trace & localStorage
                content (provided it's not private):
              </div>
              <div className="ErrorSplash-paragraph">
                <div className="ErrorSplash-details">
                  <label>Error stack trace:</label>
                  <textarea
                    rows={10}
                    onPointerDown={this.selectTextArea}
                    readOnly={true}
                    value={
                      this.state.unresolvedError
                        ? "Loading data. please wait..."
                        : this.state.stack
                    }
                  />
                  <label>LocalStorage content:</label>
                  <textarea
                    rows={5}
                    onPointerDown={this.selectTextArea}
                    readOnly={true}
                    value={this.state.localStorage}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.render(
  <TopErrorBoundary>
    <IsMobileProvider>
      <App />
    </IsMobileProvider>
  </TopErrorBoundary>,
  rootElement,
);
