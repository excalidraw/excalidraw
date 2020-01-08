import React from "react";
import ReactDOM from "react-dom";
import rough from "roughjs/bin/wrappers/rough";

import { moveOneLeft, moveAllLeft, moveOneRight, moveAllRight } from "./zindex";
import { randomSeed } from "./random";
import {
  newElement,
  duplicateElement,
  resizeTest,
  isTextElement,
  textWysiwyg
} from "./element";
import {
  clearSelection,
  getSelectedIndices,
  deleteSelectedElements,
  setSelection,
  isOverScrollBars,
  someElementIsSelected,
  getSelectedAttribute,
  loadFromJSON,
  saveAsJSON,
  exportAsPNG,
  restoreFromLocalStorage,
  saveToLocalStorage,
  hasBackground,
  hasStroke,
  getElementAtPosition,
  createScene
} from "./scene";

import { renderScene } from "./renderer";
import { AppState } from "./types";
import { ExcalidrawElement, ExcalidrawTextElement } from "./element/types";

import { getDateTime, isInputLike, measureText } from "./utils";

import { ButtonSelect } from "./components/ButtonSelect";
import { findShapeByKey, shapesShortcutKeys } from "./shapes";
import { createHistory } from "./history";

import ContextMenu from "./components/ContextMenu";
import { PanelTools } from "./components/panels/PanelTools";
import { PanelSelection } from "./components/panels/PanelSelection";
import { PanelColor } from "./components/panels/PanelColor";
import { PanelExport } from "./components/panels/PanelExport";
import { PanelCanvas } from "./components/panels/PanelCanvas";

import "./styles.scss";

const { elements } = createScene();
const { history } = createHistory();
const DEFAULT_PROJECT_NAME = `excalidraw-${getDateTime()}`;

const CANVAS_WINDOW_OFFSET_LEFT = 250;
const CANVAS_WINDOW_OFFSET_TOP = 0;

export const KEYS = {
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  ARROW_DOWN: "ArrowDown",
  ARROW_UP: "ArrowUp",
  ENTER: "Enter",
  ESCAPE: "Escape",
  DELETE: "Delete",
  BACKSPACE: "Backspace"
};

const META_KEY = /Mac|iPod|iPhone|iPad/.test(window.navigator.platform)
  ? "metaKey"
  : "ctrlKey";

let copiedStyles: string = "{}";

function isArrowKey(keyCode: string) {
  return (
    keyCode === KEYS.ARROW_LEFT ||
    keyCode === KEYS.ARROW_RIGHT ||
    keyCode === KEYS.ARROW_DOWN ||
    keyCode === KEYS.ARROW_UP
  );
}

function resetCursor() {
  document.documentElement.style.cursor = "";
}

function addTextElement(
  element: ExcalidrawTextElement,
  text: string,
  font: string
) {
  resetCursor();
  if (text === null || text === "") {
    return false;
  }

  const metrics = measureText(text, font);
  element.text = text;
  element.font = font;
  // Center the text
  element.x -= metrics.width / 2;
  element.y -= metrics.height / 2;
  element.width = metrics.width;
  element.height = metrics.height;
  element.baseline = metrics.baseline;

  return true;
}

const ELEMENT_SHIFT_TRANSLATE_AMOUNT = 5;
const ELEMENT_TRANSLATE_AMOUNT = 1;

let lastCanvasWidth = -1;
let lastCanvasHeight = -1;

let lastMouseUp: ((e: any) => void) | null = null;

class App extends React.Component<{}, AppState> {
  public componentDidMount() {
    document.addEventListener("keydown", this.onKeyDown, false);
    window.addEventListener("resize", this.onResize, false);

    const savedState = restoreFromLocalStorage(elements);
    if (savedState) {
      this.setState(savedState);
    }
  }

  public componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyDown, false);
    window.removeEventListener("resize", this.onResize, false);
  }

  public state: AppState = {
    draggingElement: null,
    resizingElement: null,
    elementType: "selection",
    exportBackground: true,
    currentItemStrokeColor: "#000000",
    currentItemBackgroundColor: "#ffffff",
    currentItemFont: "20px Virgil",
    viewBackgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
    name: DEFAULT_PROJECT_NAME
  };

  private onResize = () => {
    this.forceUpdate();
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (isInputLike(event.target)) return;

    if (event.key === KEYS.ESCAPE) {
      clearSelection(elements);
      this.forceUpdate();
      event.preventDefault();
    } else if (event.key === KEYS.BACKSPACE || event.key === KEYS.DELETE) {
      this.deleteSelectedElements();
      event.preventDefault();
    } else if (isArrowKey(event.key)) {
      const step = event.shiftKey
        ? ELEMENT_SHIFT_TRANSLATE_AMOUNT
        : ELEMENT_TRANSLATE_AMOUNT;
      elements.forEach(element => {
        if (element.isSelected) {
          if (event.key === KEYS.ARROW_LEFT) element.x -= step;
          else if (event.key === KEYS.ARROW_RIGHT) element.x += step;
          else if (event.key === KEYS.ARROW_UP) element.y -= step;
          else if (event.key === KEYS.ARROW_DOWN) element.y += step;
        }
      });
      this.forceUpdate();
      event.preventDefault();

      // Send backward: Cmd-Shift-Alt-B
    } else if (
      event[META_KEY] &&
      event.shiftKey &&
      event.altKey &&
      event.code === "KeyB"
    ) {
      this.moveOneLeft();
      event.preventDefault();

      // Send to back: Cmd-Shift-B
    } else if (event[META_KEY] && event.shiftKey && event.code === "KeyB") {
      this.moveAllLeft();
      event.preventDefault();

      // Bring forward: Cmd-Shift-Alt-F
    } else if (
      event[META_KEY] &&
      event.shiftKey &&
      event.altKey &&
      event.code === "KeyF"
    ) {
      this.moveOneRight();
      event.preventDefault();

      // Bring to front: Cmd-Shift-F
    } else if (event[META_KEY] && event.shiftKey && event.code === "KeyF") {
      this.moveAllRight();
      event.preventDefault();
      // Select all: Cmd-A
    } else if (event[META_KEY] && event.code === "KeyA") {
      elements.forEach(element => {
        element.isSelected = true;
      });
      this.forceUpdate();
      event.preventDefault();
    } else if (shapesShortcutKeys.includes(event.key.toLowerCase())) {
      this.setState({ elementType: findShapeByKey(event.key) });
    } else if (event[META_KEY] && event.code === "KeyZ") {
      if (event.shiftKey) {
        // Redo action
        history.redoOnce(elements);
      } else {
        // undo action
        history.undoOnce(elements);
      }
      this.forceUpdate();
      event.preventDefault();
      // Copy Styles: Cmd-Shift-C
    } else if (event.metaKey && event.shiftKey && event.code === "KeyC") {
      this.copyStyles();
      // Paste Styles: Cmd-Shift-V
    } else if (event.metaKey && event.shiftKey && event.code === "KeyV") {
      this.pasteStyles();
      event.preventDefault();
    }
  };

  private deleteSelectedElements = () => {
    deleteSelectedElements(elements);
    this.forceUpdate();
  };

  private clearCanvas = () => {
    if (window.confirm("This will clear the whole canvas. Are you sure?")) {
      elements.splice(0, elements.length);
      this.setState({
        viewBackgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0
      });
      this.forceUpdate();
    }
  };

  private copyStyles = () => {
    const element = elements.find(el => el.isSelected);
    if (element) {
      copiedStyles = JSON.stringify(element);
    }
  };

  private pasteStyles = () => {
    const pastedElement = JSON.parse(copiedStyles);
    elements.forEach(element => {
      if (element.isSelected) {
        element.backgroundColor = pastedElement?.backgroundColor;
        element.strokeWidth = pastedElement?.strokeWidth;
        element.strokeColor = pastedElement?.strokeColor;
        element.fillStyle = pastedElement?.fillStyle;
        element.opacity = pastedElement?.opacity;
        element.roughness = pastedElement?.roughness;
      }
    });
    this.forceUpdate();
  };

  private moveAllLeft = () => {
    moveAllLeft(elements, getSelectedIndices(elements));
    this.forceUpdate();
  };

  private moveOneLeft = () => {
    moveOneLeft(elements, getSelectedIndices(elements));
    this.forceUpdate();
  };

  private moveAllRight = () => {
    moveAllRight(elements, getSelectedIndices(elements));
    this.forceUpdate();
  };

  private moveOneRight = () => {
    moveOneRight(elements, getSelectedIndices(elements));
    this.forceUpdate();
  };

  private removeWheelEventListener: (() => void) | undefined;

  private updateProjectName(name: string): void {
    this.setState({ name });
  }

  private changeProperty = (callback: (element: ExcalidrawElement) => void) => {
    elements.forEach(element => {
      if (element.isSelected) {
        callback(element);
      }
    });

    this.forceUpdate();
  };

  private changeOpacity = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.changeProperty(element => (element.opacity = +event.target.value));
  };

  private changeStrokeColor = (color: string) => {
    this.changeProperty(element => (element.strokeColor = color));
    this.setState({ currentItemStrokeColor: color });
  };

  private changeBackgroundColor = (color: string) => {
    this.changeProperty(element => (element.backgroundColor = color));
    this.setState({ currentItemBackgroundColor: color });
  };

  private copyToClipboard = () => {
    if (navigator.clipboard) {
      const text = JSON.stringify(
        elements.filter(element => element.isSelected)
      );
      navigator.clipboard.writeText(text);
    }
  };

  private pasteFromClipboard = (x?: number, y?: number) => {
    if (navigator.clipboard) {
      navigator.clipboard
        .readText()
        .then(text => this.addElementsFromPaste(text, x, y));
    }
  };

  public render() {
    const canvasWidth = window.innerWidth - CANVAS_WINDOW_OFFSET_LEFT;
    const canvasHeight = window.innerHeight - CANVAS_WINDOW_OFFSET_TOP;

    return (
      <div
        className="container"
        onCut={e => {
          e.clipboardData.setData(
            "text/plain",
            JSON.stringify(elements.filter(element => element.isSelected))
          );
          deleteSelectedElements(elements);
          this.forceUpdate();
          e.preventDefault();
        }}
        onCopy={e => {
          e.clipboardData.setData(
            "text/plain",
            JSON.stringify(elements.filter(element => element.isSelected))
          );
          e.preventDefault();
        }}
        onPaste={e => {
          const paste = e.clipboardData.getData("text");
          this.addElementsFromPaste(paste);
          e.preventDefault();
        }}
      >
        <div className="sidePanel">
          <PanelTools
            activeTool={this.state.elementType}
            onToolChange={value => {
              this.setState({ elementType: value });
              clearSelection(elements);
              document.documentElement.style.cursor =
                value === "text" ? "text" : "crosshair";
              this.forceUpdate();
            }}
          />
          {someElementIsSelected(elements) && (
            <div className="panelColumn">
              <PanelSelection
                onBringForward={this.moveOneRight}
                onBringToFront={this.moveAllRight}
                onSendBackward={this.moveOneLeft}
                onSendToBack={this.moveAllLeft}
              />

              <PanelColor
                title="Stroke Color"
                onColorChange={this.changeStrokeColor}
                colorValue={getSelectedAttribute(
                  elements,
                  element => element.strokeColor
                )}
              />

              {hasBackground(elements) && (
                <>
                  <PanelColor
                    title="Background Color"
                    onColorChange={this.changeBackgroundColor}
                    colorValue={getSelectedAttribute(
                      elements,
                      element => element.backgroundColor
                    )}
                  />

                  <h5>Fill</h5>
                  <ButtonSelect
                    options={[
                      { value: "solid", text: "Solid" },
                      { value: "hachure", text: "Hachure" },
                      { value: "cross-hatch", text: "Cross-hatch" }
                    ]}
                    value={getSelectedAttribute(
                      elements,
                      element => element.fillStyle
                    )}
                    onChange={value => {
                      this.changeProperty(element => {
                        element.fillStyle = value;
                      });
                    }}
                  />
                </>
              )}

              {hasStroke(elements) && (
                <>
                  <h5>Stroke Width</h5>
                  <ButtonSelect
                    options={[
                      { value: 1, text: "Thin" },
                      { value: 2, text: "Bold" },
                      { value: 4, text: "Extra Bold" }
                    ]}
                    value={getSelectedAttribute(
                      elements,
                      element => element.strokeWidth
                    )}
                    onChange={value => {
                      this.changeProperty(element => {
                        element.strokeWidth = value;
                      });
                    }}
                  />

                  <h5>Sloppiness</h5>
                  <ButtonSelect
                    options={[
                      { value: 0, text: "Draftsman" },
                      { value: 1, text: "Artist" },
                      { value: 3, text: "Cartoonist" }
                    ]}
                    value={getSelectedAttribute(
                      elements,
                      element => element.roughness
                    )}
                    onChange={value =>
                      this.changeProperty(element => {
                        element.roughness = value;
                      })
                    }
                  />
                </>
              )}

              <h5>Opacity</h5>
              <input
                type="range"
                min="0"
                max="100"
                onChange={this.changeOpacity}
                value={
                  getSelectedAttribute(elements, element => element.opacity) ||
                  0 /* Put the opacity at 0 if there are two conflicting ones */
                }
              />

              <button onClick={this.deleteSelectedElements}>
                Delete selected
              </button>
            </div>
          )}
          <PanelCanvas
            onClearCanvas={this.clearCanvas}
            onViewBackgroundColorChange={val =>
              this.setState({ viewBackgroundColor: val })
            }
            viewBackgroundColor={this.state.viewBackgroundColor}
          />
          <PanelExport
            projectName={this.state.name}
            onProjectNameChange={this.updateProjectName}
            onExportAsPNG={() => exportAsPNG(elements, canvas, this.state)}
            exportBackground={this.state.exportBackground}
            onExportBackgroundChange={val =>
              this.setState({ exportBackground: val })
            }
            onSaveScene={() => saveAsJSON(elements, this.state.name)}
            onLoadScene={() =>
              loadFromJSON(elements).then(() => this.forceUpdate())
            }
          />
        </div>
        <canvas
          id="canvas"
          style={{
            width: canvasWidth,
            height: canvasHeight
          }}
          width={canvasWidth * window.devicePixelRatio}
          height={canvasHeight * window.devicePixelRatio}
          ref={canvas => {
            if (this.removeWheelEventListener) {
              this.removeWheelEventListener();
              this.removeWheelEventListener = undefined;
            }
            if (canvas) {
              canvas.addEventListener("wheel", this.handleWheel, {
                passive: false
              });
              this.removeWheelEventListener = () =>
                canvas.removeEventListener("wheel", this.handleWheel);

              // Whenever React sets the width/height of the canvas element,
              // the context loses the scale transform. We need to re-apply it
              if (
                canvasWidth !== lastCanvasWidth ||
                canvasHeight !== lastCanvasHeight
              ) {
                lastCanvasWidth = canvasWidth;
                lastCanvasHeight = canvasHeight;
                canvas
                  .getContext("2d")!
                  .scale(window.devicePixelRatio, window.devicePixelRatio);
              }
            }
          }}
          onContextMenu={e => {
            e.preventDefault();

            const x =
              e.clientX - CANVAS_WINDOW_OFFSET_LEFT - this.state.scrollX;
            const y = e.clientY - CANVAS_WINDOW_OFFSET_TOP - this.state.scrollY;

            const element = getElementAtPosition(elements, x, y);
            if (!element) {
              ContextMenu.push({
                options: [
                  navigator.clipboard && {
                    label: "Paste",
                    action: () => this.pasteFromClipboard(x, y)
                  }
                ],
                top: e.clientY,
                left: e.clientX
              });
              return;
            }

            if (!element.isSelected) {
              clearSelection(elements);
              element.isSelected = true;
              this.forceUpdate();
            }

            ContextMenu.push({
              options: [
                navigator.clipboard && {
                  label: "Copy",
                  action: this.copyToClipboard
                },
                navigator.clipboard && {
                  label: "Paste",
                  action: () => this.pasteFromClipboard(x, y)
                },
                { label: "Copy Styles", action: this.copyStyles },
                { label: "Paste Styles", action: this.pasteStyles },
                { label: "Delete", action: this.deleteSelectedElements },
                { label: "Move Forward", action: this.moveOneRight },
                { label: "Send to Front", action: this.moveAllRight },
                { label: "Move Backwards", action: this.moveOneLeft },
                { label: "Send to Back", action: this.moveAllLeft }
              ],
              top: e.clientY,
              left: e.clientX
            });
          }}
          onMouseDown={e => {
            if (lastMouseUp !== null) {
              // Unfortunately, sometimes we don't get a mouseup after a mousedown,
              // this can happen when a contextual menu or alert is triggered. In order to avoid
              // being in a weird state, we clean up on the next mousedown
              lastMouseUp(e);
            }
            // only handle left mouse button
            if (e.button !== 0) return;
            // fixes mousemove causing selection of UI texts #32
            e.preventDefault();
            // Preventing the event above disables default behavior
            //  of defocusing potentially focused input, which is what we want
            //  when clicking inside the canvas.
            if (isInputLike(document.activeElement)) {
              document.activeElement.blur();
            }

            // Handle scrollbars dragging
            const {
              isOverHorizontalScrollBar,
              isOverVerticalScrollBar
            } = isOverScrollBars(
              elements,
              e.clientX - CANVAS_WINDOW_OFFSET_LEFT,
              e.clientY - CANVAS_WINDOW_OFFSET_TOP,
              canvasWidth,
              canvasHeight,
              this.state.scrollX,
              this.state.scrollY
            );

            const x =
              e.clientX - CANVAS_WINDOW_OFFSET_LEFT - this.state.scrollX;
            const y = e.clientY - CANVAS_WINDOW_OFFSET_TOP - this.state.scrollY;
            const element = newElement(
              this.state.elementType,
              x,
              y,
              this.state.currentItemStrokeColor,
              this.state.currentItemBackgroundColor,
              "hachure",
              1,
              1,
              100
            );
            let resizeHandle: ReturnType<typeof resizeTest> = false;
            let isDraggingElements = false;
            let isResizingElements = false;
            if (this.state.elementType === "selection") {
              const resizeElement = elements.find(element => {
                return resizeTest(element, x, y, {
                  scrollX: this.state.scrollX,
                  scrollY: this.state.scrollY,
                  viewBackgroundColor: this.state.viewBackgroundColor
                });
              });

              this.setState({
                resizingElement: resizeElement ? resizeElement : null
              });

              if (resizeElement) {
                resizeHandle = resizeTest(resizeElement, x, y, {
                  scrollX: this.state.scrollX,
                  scrollY: this.state.scrollY,
                  viewBackgroundColor: this.state.viewBackgroundColor
                });
                document.documentElement.style.cursor = `${resizeHandle}-resize`;
                isResizingElements = true;
              } else {
                const hitElement = getElementAtPosition(elements, x, y);

                // If we click on something
                if (hitElement) {
                  if (hitElement.isSelected) {
                    // If that element is not already selected, do nothing,
                    // we're likely going to drag it
                  } else {
                    // We unselect every other elements unless shift is pressed
                    if (!e.shiftKey) {
                      clearSelection(elements);
                    }
                  }
                  // No matter what, we select it
                  hitElement.isSelected = true;
                  // We duplicate the selected element if alt is pressed on Mouse down
                  if (e.altKey) {
                    elements.push(
                      ...elements.reduce((duplicates, element) => {
                        if (element.isSelected) {
                          duplicates.push(duplicateElement(element));
                          element.isSelected = false;
                        }
                        return duplicates;
                      }, [] as typeof elements)
                    );
                  }
                } else {
                  // If we don't click on anything, let's remove all the selected elements
                  clearSelection(elements);
                }

                isDraggingElements = someElementIsSelected(elements);

                if (isDraggingElements) {
                  document.documentElement.style.cursor = "move";
                }
              }
            }

            if (isTextElement(element)) {
              textWysiwyg({
                initText: "",
                x: e.clientX,
                y: e.clientY,
                strokeColor: this.state.currentItemStrokeColor,
                font: this.state.currentItemFont,
                onSubmit: text => {
                  addTextElement(element, text, this.state.currentItemFont);
                  elements.push(element);
                  element.isSelected = true;
                  this.setState({
                    draggingElement: null,
                    elementType: "selection"
                  });
                }
              });
              return;
            }

            elements.push(element);
            if (this.state.elementType === "text") {
              this.setState({
                draggingElement: null,
                elementType: "selection"
              });
              element.isSelected = true;
            } else {
              this.setState({ draggingElement: element });
            }

            let lastX = x;
            let lastY = y;

            if (isOverHorizontalScrollBar || isOverVerticalScrollBar) {
              lastX = e.clientX - CANVAS_WINDOW_OFFSET_LEFT;
              lastY = e.clientY - CANVAS_WINDOW_OFFSET_TOP;
            }

            const onMouseMove = (e: MouseEvent) => {
              const target = e.target;
              if (!(target instanceof HTMLElement)) {
                return;
              }

              if (isOverHorizontalScrollBar) {
                const x = e.clientX - CANVAS_WINDOW_OFFSET_LEFT;
                const dx = x - lastX;
                this.setState(state => ({ scrollX: state.scrollX - dx }));
                lastX = x;
                return;
              }

              if (isOverVerticalScrollBar) {
                const y = e.clientY - CANVAS_WINDOW_OFFSET_TOP;
                const dy = y - lastY;
                this.setState(state => ({ scrollY: state.scrollY - dy }));
                lastY = y;
                return;
              }

              if (isResizingElements && this.state.resizingElement) {
                const el = this.state.resizingElement;
                const selectedElements = elements.filter(el => el.isSelected);
                if (selectedElements.length === 1) {
                  const x =
                    e.clientX - CANVAS_WINDOW_OFFSET_LEFT - this.state.scrollX;
                  const y =
                    e.clientY - CANVAS_WINDOW_OFFSET_TOP - this.state.scrollY;
                  selectedElements.forEach(element => {
                    switch (resizeHandle) {
                      case "nw":
                        element.width += element.x - lastX;
                        element.x = lastX;
                        if (e.shiftKey) {
                          element.y += element.height - element.width;
                          element.height = element.width;
                        } else {
                          element.height += element.y - lastY;
                          element.y = lastY;
                        }
                        break;
                      case "ne":
                        element.width = lastX - element.x;
                        if (e.shiftKey) {
                          element.y += element.height - element.width;
                          element.height = element.width;
                        } else {
                          element.height += element.y - lastY;
                          element.y = lastY;
                        }
                        break;
                      case "sw":
                        element.width += element.x - lastX;
                        element.x = lastX;
                        if (e.shiftKey) {
                          element.height = element.width;
                        } else {
                          element.height = lastY - element.y;
                        }
                        break;
                      case "se":
                        element.width += x - lastX;
                        if (e.shiftKey) {
                          element.height = element.width;
                        } else {
                          element.height += y - lastY;
                        }
                        break;
                      case "n":
                        element.height += element.y - lastY;
                        element.y = lastY;
                        break;
                      case "w":
                        element.width += element.x - lastX;
                        element.x = lastX;
                        break;
                      case "s":
                        element.height = lastY - element.y;
                        break;
                      case "e":
                        element.width = lastX - element.x;
                        break;
                    }

                    el.x = element.x;
                    el.y = element.y;
                  });
                  lastX = x;
                  lastY = y;
                  // We don't want to save history when resizing an element
                  history.skipRecording();
                  this.forceUpdate();
                  return;
                }
              }

              if (isDraggingElements) {
                const selectedElements = elements.filter(el => el.isSelected);
                if (selectedElements.length) {
                  const x =
                    e.clientX - CANVAS_WINDOW_OFFSET_LEFT - this.state.scrollX;
                  const y =
                    e.clientY - CANVAS_WINDOW_OFFSET_TOP - this.state.scrollY;
                  selectedElements.forEach(element => {
                    element.x += x - lastX;
                    element.y += y - lastY;
                  });
                  lastX = x;
                  lastY = y;
                  // We don't want to save history when dragging an element to initially size it
                  history.skipRecording();
                  this.forceUpdate();
                  return;
                }
              }

              // It is very important to read this.state within each move event,
              // otherwise we would read a stale one!
              const draggingElement = this.state.draggingElement;
              if (!draggingElement) return;
              let width =
                e.clientX -
                CANVAS_WINDOW_OFFSET_LEFT -
                draggingElement.x -
                this.state.scrollX;
              let height =
                e.clientY -
                CANVAS_WINDOW_OFFSET_TOP -
                draggingElement.y -
                this.state.scrollY;
              draggingElement.width = width;
              // Make a perfect square or circle when shift is enabled
              draggingElement.height = e.shiftKey
                ? Math.abs(width) * Math.sign(height)
                : height;

              if (this.state.elementType === "selection") {
                setSelection(elements, draggingElement);
              }
              // We don't want to save history when moving an element
              history.skipRecording();
              this.forceUpdate();
            };

            const onMouseUp = (e: MouseEvent) => {
              const { draggingElement, elementType } = this.state;

              lastMouseUp = null;
              window.removeEventListener("mousemove", onMouseMove);
              window.removeEventListener("mouseup", onMouseUp);

              resetCursor();

              // if no element is clicked, clear the selection and redraw
              if (draggingElement === null) {
                clearSelection(elements);
                this.forceUpdate();
                return;
              }

              if (elementType === "selection") {
                if (isDraggingElements) {
                  isDraggingElements = false;
                }
                elements.pop();
              } else {
                draggingElement.isSelected = true;
              }

              this.setState({
                draggingElement: null,
                elementType: "selection"
              });
              this.forceUpdate();
            };

            lastMouseUp = onMouseUp;

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);

            // We don't want to save history on mouseDown, only on mouseUp when it's fully configured
            history.skipRecording();
            this.forceUpdate();
          }}
          onDoubleClick={e => {
            const x =
              e.clientX - CANVAS_WINDOW_OFFSET_LEFT - this.state.scrollX;
            const y = e.clientY - CANVAS_WINDOW_OFFSET_TOP - this.state.scrollY;
            const elementAtPosition = getElementAtPosition(elements, x, y);
            if (elementAtPosition && !isTextElement(elementAtPosition)) {
              return;
            } else if (elementAtPosition) {
              elements.splice(elements.indexOf(elementAtPosition), 1);
              this.forceUpdate();
            }

            const element = newElement(
              "text",
              x,
              y,
              this.state.currentItemStrokeColor,
              this.state.currentItemBackgroundColor,
              "hachure",
              1,
              1,
              100
            ) as ExcalidrawTextElement;

            let initText = "";
            let textX = e.clientX;
            let textY = e.clientY;
            if (elementAtPosition) {
              Object.assign(element, elementAtPosition);
              // x and y will change after calling addTextElement function
              element.x = elementAtPosition.x + elementAtPosition.width / 2;
              element.y = elementAtPosition.y + elementAtPosition.height / 2;
              initText = elementAtPosition.text;
              textX =
                this.state.scrollX +
                elementAtPosition.x +
                CANVAS_WINDOW_OFFSET_LEFT +
                elementAtPosition.width / 2;
              textY =
                this.state.scrollY +
                elementAtPosition.y +
                CANVAS_WINDOW_OFFSET_TOP +
                elementAtPosition.height / 2;
            }

            textWysiwyg({
              initText,
              x: textX,
              y: textY,
              strokeColor: element.strokeColor,
              font: element.font || this.state.currentItemFont,
              onSubmit: text => {
                addTextElement(
                  element,
                  text,
                  element.font || this.state.currentItemFont
                );
                elements.push(element);
                element.isSelected = true;
                this.setState({
                  draggingElement: null,
                  elementType: "selection"
                });
              }
            });
          }}
        />
      </div>
    );
  }

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const { deltaX, deltaY } = e;
    this.setState(state => ({
      scrollX: state.scrollX - deltaX,
      scrollY: state.scrollY - deltaY
    }));
  };

  private addElementsFromPaste = (paste: string, x?: number, y?: number) => {
    let parsedElements;
    try {
      parsedElements = JSON.parse(paste);
    } catch (e) {}
    if (
      Array.isArray(parsedElements) &&
      parsedElements.length > 0 &&
      parsedElements[0].type // need to implement a better check here...
    ) {
      clearSelection(elements);

      if (x == null) x = 10 - this.state.scrollX;
      if (y == null) y = 10 - this.state.scrollY;
      const minX = Math.min(...parsedElements.map(element => element.x));
      const minY = Math.min(...parsedElements.map(element => element.y));
      const dx = x - minX;
      const dy = y - minY;

      parsedElements.forEach(parsedElement => {
        const duplicate = duplicateElement(parsedElement);
        duplicate.x += dx;
        duplicate.y += dy;
        elements.push(duplicate);
      });
      this.forceUpdate();
    }
  };

  componentDidUpdate() {
    renderScene(elements, rc, canvas, {
      scrollX: this.state.scrollX,
      scrollY: this.state.scrollY,
      viewBackgroundColor: this.state.viewBackgroundColor
    });
    saveToLocalStorage(elements, this.state);
    if (history.isRecording()) {
      history.pushEntry(history.generateCurrentEntry(elements));
      history.clearRedoStack();
    }
    history.resumeRecording();
  }
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const rc = rough.canvas(canvas);

ReactDOM.render(<App />, rootElement);
