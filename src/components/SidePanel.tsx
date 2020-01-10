import React from "react";
import { PanelTools } from "./panels/PanelTools";
import { Panel } from "./Panel";
import { PanelSelection } from "./panels/PanelSelection";
import { PanelColor } from "./panels/PanelColor";
import {
  hasBackground,
  someElementIsSelected,
  getSelectedAttribute,
  hasStroke,
  hasText,
  loadFromJSON,
  saveAsJSON,
  exportCanvas,
  deleteSelectedElements
} from "../scene";
import { ButtonSelect } from "./ButtonSelect";
import { ExcalidrawElement } from "../element/types";
import { redrawTextBoundingBox, isTextElement } from "../element";
import { PanelCanvas } from "./panels/PanelCanvas";
import { PanelExport } from "./panels/PanelExport";
import { ExportType } from "../scene/types";
import { AppState } from "../types";

interface SidePanelProps {
  elements: readonly ExcalidrawElement[];
  onToolChange: (elementType: string) => void;
  changeProperty: (
    callback: (element: ExcalidrawElement) => ExcalidrawElement
  ) => void;
  moveAllLeft: () => void;
  moveOneLeft: () => void;
  moveAllRight: () => void;
  moveOneRight: () => void;
  onClearCanvas: React.MouseEventHandler;
  onUpdateAppState: (name: string, value: any) => void;
  appState: AppState;
  onUpdateElements: (elements: readonly ExcalidrawElement[]) => void;
  canvas: HTMLCanvasElement;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  elements,
  onToolChange,
  changeProperty,
  moveAllLeft,
  moveOneLeft,
  moveAllRight,
  moveOneRight,
  onClearCanvas,
  onUpdateAppState,
  appState,
  onUpdateElements,
  canvas
}) => {
  return (
    <div className="sidePanel">
      <PanelTools
        activeTool={appState.elementType}
        onToolChange={value => {
          onToolChange(value);
        }}
      />
      <Panel title="Selection" hide={!someElementIsSelected(elements)}>
        <PanelSelection
          onBringForward={moveOneRight}
          onBringToFront={moveAllRight}
          onSendBackward={moveOneLeft}
          onSendToBack={moveAllLeft}
        />

        <PanelColor
          title="Stroke Color"
          onColorChange={(color: string) => {
            changeProperty(element => ({
              ...element,
              strokeColor: color
            }));
            onUpdateAppState("currentItemStrokeColor", color);
          }}
          colorValue={getSelectedAttribute(
            elements,
            element => element.strokeColor
          )}
        />

        {hasBackground(elements) && (
          <>
            <PanelColor
              title="Background Color"
              onColorChange={(color: string) => {
                changeProperty(element => ({
                  ...element,
                  backgroundColor: color
                }));
                onUpdateAppState("currentItemBackgroundColor", color);
              }}
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
                changeProperty(element => ({
                  ...element,
                  fillStyle: value
                }));
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
                changeProperty(element => ({
                  ...element,
                  strokeWidth: value
                }));
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
                changeProperty(element => ({
                  ...element,
                  roughness: value
                }))
              }
            />
          </>
        )}

        {hasText(elements) && (
          <>
            <h5>Font size</h5>
            <ButtonSelect
              options={[
                { value: 16, text: "Small" },
                { value: 20, text: "Medium" },
                { value: 28, text: "Large" },
                { value: 36, text: "Very Large" }
              ]}
              value={getSelectedAttribute(
                elements,
                element =>
                  isTextElement(element) && +element.font.split("px ")[0]
              )}
              onChange={value =>
                changeProperty(element => {
                  if (isTextElement(element)) {
                    element.font = `${value}px ${element.font.split("px ")[1]}`;
                    redrawTextBoundingBox(element);
                  }

                  return element;
                })
              }
            />
            <h5>Font familly</h5>
            <ButtonSelect
              options={[
                { value: "Virgil", text: "Virgil" },
                { value: "Helvetica", text: "Helvetica" },
                { value: "Courier", text: "Courier" }
              ]}
              value={getSelectedAttribute(
                elements,
                element =>
                  isTextElement(element) && element.font.split("px ")[1]
              )}
              onChange={value =>
                changeProperty(element => {
                  if (isTextElement(element)) {
                    element.font = `${element.font.split("px ")[0]}px ${value}`;
                    redrawTextBoundingBox(element);
                  }

                  return element;
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
          onChange={event => {
            changeProperty(element => ({
              ...element,
              opacity: +event.target.value
            }));
          }}
          value={
            getSelectedAttribute(elements, element => element.opacity) ||
            0 /* Put the opacity at 0 if there are two conflicting ones */
          }
        />

        <button
          onClick={() => {
            onUpdateElements(deleteSelectedElements(elements));
          }}
        >
          Delete selected
        </button>
      </Panel>
      <PanelCanvas
        onClearCanvas={onClearCanvas}
        onViewBackgroundColorChange={value => {
          onUpdateAppState("viewBackgroundColor", value);
        }}
        viewBackgroundColor={appState.viewBackgroundColor}
      />
      <PanelExport
        projectName={appState.name}
        onProjectNameChange={name => {
          onUpdateAppState("name", name);
        }}
        onExportCanvas={(type: ExportType) =>
          exportCanvas(type, elements, canvas, appState)
        }
        exportBackground={appState.exportBackground}
        onExportBackgroundChange={value => {
          onUpdateAppState("exportBackground", value);
        }}
        onSaveScene={() => saveAsJSON(elements, appState.name)}
        onLoadScene={() =>
          loadFromJSON().then(({ elements }) => {
            onUpdateElements(elements);
          })
        }
      />
    </div>
  );
};
