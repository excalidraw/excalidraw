import { useEffect, useRef, useState, type ReactNode } from "react";

import { pointFrom, pointRotateRads } from "@excalidraw/math";
import {
  getElementAbsoluteCoords,
  isLinearElement,
  canHaveArrowheads,
} from "@excalidraw/element";

import { CLASSES } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  Arrowhead,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

import { sceneCoordsToViewportCoords } from "..";

import { atom } from "../editor-jotai";

import { editorJotaiStore } from "../editor-jotai";
import {
  actionChangeArrowhead,
  getArrowheadOptions,
} from "../actions/actionProperties";
import { getLanguage } from "../i18n";

import { ToolButton } from "./ToolButton";

import type App from "./App";

// Generic types and interfaces for property editing
export interface PropertyOption<T> {
  value: T;
  icon: ReactNode;
  text: string;
  keyBinding?: string;
}

export interface PropertyEditor<T extends ExcalidrawElement, P> {
  /** Type identifier for this property editor */
  type: string;
  /** Check if the elements are valid for this property editor */
  isValidForElements: (
    app: App,
    elements: readonly ExcalidrawElement[],
  ) => elements is readonly T[];
  /** Get the current property value from an element */
  getCurrentValue: (element: T, context?: any) => P;
  /** Get available options for this property */
  getOptions: () => PropertyOption<P>[];
  /** Handle property change */
  onChange: (app: App, context?: any, element?: T, newValue?: P) => void;
  /** Handle property cycle */
  cycle: (
    app: App,
    elements: readonly T[],
    direction?: "left" | "right",
  ) => boolean;
  /** Get additional context data (e.g., position for arrowheads) */
  getContext?: (app: App, elements: readonly T[]) => any;
}

// Generic popup state type
export type ChangeElementPropertyPopupState<TContext = any> = {
  type: "panel";
  /** Type of property being edited */
  propertyType: string;
  /** Additional context for the property editor */
  context?: TContext;
} | null;

/**
 * Generic atom for tracking popup state
 */
export const changeElementPropertyPopupAtom =
  atom<ChangeElementPropertyPopupState>(null);

// Arrowhead property editor implementation
export interface ArrowheadContext {
  /** which endpoint of the arrow we are editing */
  position: "start" | "end";
}

export const arrowheadPropertyEditor: PropertyEditor<
  ExcalidrawLinearElement,
  Arrowhead | null
> = {
  type: "arrowhead",

  isValidForElements: (
    app,
    elements,
  ): elements is readonly ExcalidrawLinearElement[] => {
    if (
      elements.length !== 1 ||
      !isLinearElement(elements[0]) ||
      !canHaveArrowheads(elements[0].type)
    ) {
      return false;
    }
    const idx = app.state.selectedLinearElement?.selectedPointsIndices?.[0];
    const { points } = elements[0];
    return idx === 0 || idx === points.length - 1;
  },

  getCurrentValue: (element, context: ArrowheadContext) => {
    return context.position === "start"
      ? element.startArrowhead
      : element.endArrowhead;
  },

  getOptions: () => {
    const isRTL = getLanguage().rtl;
    return getArrowheadOptions(!!isRTL).slice(0, 4);
  },

  onChange: (app, context, element?, newValue?) => {
    const result = actionChangeArrowhead.perform(
      [element as OrderedExcalidrawElement],
      app.state,
      {
        position: context.position,
        type: newValue as Arrowhead,
      },
    );

    const existingElements = app.scene.getNonDeletedElementsMap().values();
    const newElements = result.elements;
    const deduplicatedElements = new Map(
      [...existingElements, ...newElements].map((element) => [
        element.id,
        element,
      ]),
    );

    app.scene.replaceAllElements(deduplicatedElements);
    app.setState(result.appState);
  },

  cycle: (app, elements, direction: "left" | "right" = "right") => {
    const context = arrowheadPropertyEditor.getContext?.(app, elements);

    const isRTL = getLanguage().rtl;
    const arrowheadOptions = getArrowheadOptions(!!isRTL).slice(0, 4);
    const element = elements[0] as ExcalidrawLinearElement;
    const current = arrowheadPropertyEditor.getCurrentValue(element, context);
    const idx = arrowheadOptions.findIndex(
      (option) => option.value === current,
    );
    const delta = direction === "right" ? 1 : -1;
    const next =
      arrowheadOptions[
        (idx + delta + arrowheadOptions.length) % arrowheadOptions.length
      ];

    arrowheadPropertyEditor.onChange(app, context, element, next.value);

    return true;
  },

  getContext: (app, elements) => {
    // Determine which endpoint of the linear element is currently selected
    const { points } = elements[0];
    const idx = app.state.selectedLinearElement?.selectedPointsIndices?.[0];

    const position =
      idx === 0 ? "start" : idx === points.length - 1 ? "end" : null;

    return { position };
  },
};

// Registry of property editors
export const propertyEditors = new Map<string, PropertyEditor<any, any>>();

// Register the arrowhead editor
propertyEditors.set("arrowhead", arrowheadPropertyEditor);

export const ChangeElementPropertyPopup = ({ app }: { app: App }) => {
  const selectedElements = app.scene.getSelectedElements(app.state);
  const popupState = editorJotaiStore.get(changeElementPropertyPopupAtom);

  // Auto-close when popup state doesn't match current selection
  useEffect(() => {
    if (!popupState) {
      return;
    }

    const editor = propertyEditors.get(popupState.propertyType);
    if (!editor || !editor.isValidForElements(app, selectedElements)) {
      app.updateEditorAtom(changeElementPropertyPopupAtom, null);
    }
  }, [selectedElements, app, popupState]);

  if (!popupState) {
    return null;
  }

  const editor = propertyEditors.get(popupState.propertyType);
  if (!editor || !editor.isValidForElements(app, selectedElements)) {
    return null;
  }

  return <Panel app={app} elements={selectedElements} editor={editor} />;
};

const Panel = <T extends ExcalidrawElement, P>({
  app,
  elements,
  editor,
}: {
  app: App;
  elements: readonly T[];
  editor: PropertyEditor<T, P>;
}) => {
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const positionRef = useRef("");
  const panelRef = useRef<HTMLDivElement>(null);
  const element = elements[0];

  const context =
    editor.getContext?.(app, elements) ||
    editorJotaiStore.get(changeElementPropertyPopupAtom)?.context;

  useEffect(() => {
    const contextKey = context ? JSON.stringify(context) : "";
    const key = `${app.state.scrollX}${app.state.scrollY}${app.state.offsetTop}${app.state.offsetLeft}${app.state.zoom.value}${element.id}_${element.version}_${contextKey}`;
    if (key === positionRef.current) {
      return;
    }
    positionRef.current = key;

    let targetPoint: { x: number; y: number };

    // For linear elements with position context (like arrowheads), position near the specific point
    if (
      isLinearElement(element) &&
      context &&
      typeof context === "object" &&
      "position" in context
    ) {
      const linearElement = element as ExcalidrawLinearElement;
      const position = (context as any).position;

      if (position === "start") {
        const firstPoint = linearElement.points[0];
        targetPoint = {
          x: element.x + firstPoint[0],
          y: element.y + firstPoint[1],
        };
      } else if (position === "end") {
        const lastPoint = linearElement.points[linearElement.points.length - 1];
        targetPoint = {
          x: element.x + lastPoint[0],
          y: element.y + lastPoint[1],
        };
      } else {
        // Fallback to element center if position is not recognized
        const [, , , , cx, cy] = getElementAbsoluteCoords(
          element,
          app.scene.getNonDeletedElementsMap(),
        );
        targetPoint = { x: cx, y: cy };
      }
    } else {
      // Default positioning for other elements (bottom-left corner)
      const [x1, , , y2, cx, cy] = getElementAbsoluteCoords(
        element,
        app.scene.getNonDeletedElementsMap(),
      );
      const bottomLeft = pointRotateRads(
        pointFrom(x1, y2),
        pointFrom(cx, cy),
        element.angle,
      );
      targetPoint = { x: bottomLeft[0], y: bottomLeft[1] };
    }

    const { x, y } = sceneCoordsToViewportCoords(
      { sceneX: targetPoint.x, sceneY: targetPoint.y },
      app.state,
    );

    setPanelPosition({ x, y });
  }, [element, app.scene, app.state, context]);
  const currentValue = editor.getCurrentValue(element, context);
  const options = editor.getOptions();

  const handleChange = (nextValue: P) => {
    if (currentValue === nextValue) {
      return;
    }
    editor.onChange(app, context, element, nextValue);
  };

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      style={{
        position: "absolute",
        top: `${
          panelPosition.y + 10 * app.state.zoom.value - app.state.offsetTop
        }px`,
        left: `${panelPosition.x - app.state.offsetLeft}px`,
        zIndex: 2,
      }}
      className={CLASSES.CONVERT_ELEMENT_TYPE_POPUP}
    >
      {options.map((option) => (
        <ToolButton
          key={`${element.id}_${option.value ?? "none"}`}
          className="Shape"
          type="radio"
          icon={option.icon}
          checked={currentValue === option.value}
          name="changeElementProperty-option"
          aria-label={`${editor.type}-${option.value ?? "none"}`}
          title={option.text}
          onChange={() => handleChange(option.value)}
        />
      ))}
    </div>
  );
};

export default ChangeElementPropertyPopup;
