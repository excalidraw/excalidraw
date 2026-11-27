import {
  CaptureUpdateAction,
  isArrowElement,
  isElbowArrow,
  newElementWith,
} from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";

import type {
  ExcalidrawArrowElement,
  ExcalidrawElbowArrowElement,
  FixedSegment,
} from "@excalidraw/element/types";

import type { Mutable } from "@excalidraw/common/utility-types";

import { DEFAULT_CATEGORIES } from "../components/CommandPalette/CommandPalette";
import { IconButton } from "../components/IconButton";
import { reverseArrowIcon } from "../components/icons";
import { t } from "../i18n";

import { register } from "./register";

/**
 * Flips an arrow end for end: the start becomes the end, so it points the other
 * way. The drawn line stays where it is — only its direction changes — and the
 * arrowheads and bindings travel with their ends.
 */
export const reverseArrow = <T extends ExcalidrawArrowElement>(
  element: T,
): T => {
  const n = element.points.length;
  if (n < 2) {
    return element;
  }
  const last = element.points[n - 1];
  // the new first point is the old last one; keep the line in place by moving
  // the element's origin there and re-basing every point on it
  const x = element.x + last[0];
  const y = element.y + last[1];
  const rebase = (p: LocalPoint) =>
    pointFrom<LocalPoint>(p[0] - last[0], p[1] - last[1]);
  const points = [...element.points].reverse().map(rebase);

  const updates: Mutable<Partial<ExcalidrawElbowArrowElement>> = {
    x,
    y,
    points,
    startBinding: element.endBinding,
    endBinding: element.startBinding,
    startArrowhead: element.endArrowhead,
    endArrowhead: element.startArrowhead,
  };

  if (isElbowArrow(element)) {
    // segment i runs from point i-1 to point i; reversed, it runs from
    // point n-1-i to n-i, so it becomes segment n-i
    updates.fixedSegments = element.fixedSegments
      ? element.fixedSegments
          .map(
            (segment): FixedSegment => ({
              index: n - segment.index,
              start: rebase(segment.end),
              end: rebase(segment.start),
            }),
          )
          .sort((a, b) => a.index - b.index)
      : null;
    updates.startIsSpecial = element.endIsSpecial;
    updates.endIsSpecial = element.startIsSpecial;
  }

  return newElementWith(element, updates as Partial<T>);
};

export const actionReverseArrow = register({
  name: "reverseArrow",
  category: DEFAULT_CATEGORIES.elements,
  label: "labels.reverseArrow",
  icon: reverseArrowIcon,
  keywords: ["direction", "swap", "flip", "arrowhead"],
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selected = app.scene.getSelectedElements(appState);
    return selected.length > 0 && selected.some(isArrowElement);
  },
  perform: (elements, appState, _, app) => {
    const selectedIds = new Set(
      app.scene.getSelectedElements(appState).map((element) => element.id),
    );
    return {
      elements: elements.map((element) =>
        selectedIds.has(element.id) && isArrowElement(element)
          ? reverseArrow(element)
          : element,
      ),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ updateData }) => (
    <IconButton
      type="button"
      icon={reverseArrowIcon}
      title={t("labels.reverseArrow")}
      aria-label={t("labels.reverseArrow")}
      onClick={() => updateData(null)}
      data-testid="reverse-arrow"
    />
  ),
});
