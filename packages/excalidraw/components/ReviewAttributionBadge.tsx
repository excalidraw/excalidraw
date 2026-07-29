import { getElementReviewAttribution } from "../review";

import { ElementCanvasButtons } from "./ElementCanvasButtons";

import "./ReviewAttributionBadge.scss";

import type {
  ElementsMap,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

export const ReviewAttributionBadge = ({
  element,
  elementsMap,
}: {
  element: NonDeletedExcalidrawElement;
  elementsMap: ElementsMap;
}) => {
  const attribution = getElementReviewAttribution(element);

  if (!attribution) {
    return null;
  }

  return (
    <ElementCanvasButtons
      className="excalidraw-review-attribution-badge-container"
      element={element}
      elementsMap={elementsMap}
    >
      <div
        className="excalidraw-review-attribution-badge"
        data-testid="review-attribution-badge"
        title={new Date(attribution.lastEditedAt).toLocaleString()}
      >
        Last edited by {attribution.lastEditedBy.username}
      </div>
    </ElementCanvasButtons>
  );
};

