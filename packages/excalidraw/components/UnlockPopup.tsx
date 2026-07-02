import {
  getCommonBounds,
  getElementsInGroup,
  isNonDeletedElement,
  selectGroupsFromGivenElements,
} from "@excalidraw/element";
import { sceneCoordsToViewportCoords } from "@excalidraw/common";

import { flushSync } from "react-dom";

import { actionToggleElementLock } from "../actions";
import { t } from "../i18n";

import "./UnlockPopup.scss";

import { LockedIconFilled } from "./icons";

import type App from "./App";

import type { AppState } from "../types";

const UnlockPopup = ({
  app,
  activeLockedId,
}: {
  app: App;
  activeLockedId: NonNullable<AppState["activeLockedId"]>;
}) => {
  const candidateElement = app.scene.getElement(activeLockedId);
  // SAFETY: This should never happen, but log it just in case
  if (candidateElement && !isNonDeletedElement(candidateElement)) {
    console.error(
      "[NONDELETED][INVARIANT] UnlockPopup: activeLockedId points to a deleted element",
    );
  }
  const element =
    candidateElement && isNonDeletedElement(candidateElement)
      ? candidateElement
      : null;

  const elements = element
    ? [element]
    : getElementsInGroup(app.scene.getNonDeletedElementsMap(), activeLockedId);

  if (elements.length === 0) {
    return null;
  }

  const [x, y] = getCommonBounds(elements);
  const { x: viewX, y: viewY } = sceneCoordsToViewportCoords(
    { sceneX: x, sceneY: y },
    app.state,
  );

  return (
    <div
      className="UnlockPopup"
      style={{
        bottom: `${app.state.height + 12 - viewY + app.state.offsetTop}px`,
        left: `${viewX - app.state.offsetLeft}px`,
      }}
      onClick={() => {
        flushSync(() => {
          const groupIds = selectGroupsFromGivenElements(elements, app.state);
          app.setState({
            selectedElementIds: elements.reduce(
              (acc, element) => ({
                ...acc,
                [element.id]: true,
              }),
              {},
            ),
            selectedGroupIds: groupIds,
            activeLockedId: null,
          });
        });
        app.actionManager.executeAction(actionToggleElementLock);
      }}
      title={t("labels.elementLock.unlock")}
    >
      {LockedIconFilled}
    </div>
  );
};

export default UnlockPopup;
