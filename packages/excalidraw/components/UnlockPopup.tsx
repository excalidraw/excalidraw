import {
  getCommonBounds,
  getElementsInGroup,
  selectGroupsFromGivenElements,
} from "@excalidraw/element";
import { sceneCoordsToViewportCoords } from "@excalidraw/common";

import { flushSync } from "react-dom";

import { actionToggleElementLock } from "../actions";
import { t } from "../i18n";

import "./UnlockPopup.scss";

import { LockedIconFilled } from "./icons";

import type App from "./App";

const UnlockPopup = ({ app }: { app: App }) => {
  const { hitLockedId } = app.state;

  if (!hitLockedId) {
    return null;
  }

  const element = app.scene.getElement(hitLockedId);

  const elements = element
    ? [element]
    : getElementsInGroup(app.scene.getNonDeletedElementsMap(), hitLockedId);

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
        position: "absolute",
        bottom: `${app.state.height + 20 - viewY + app.state.offsetTop}px`,
        left: `${viewX - app.state.offsetLeft}px`,
        zIndex: 2,
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
            hitLockedId: null,
          });
        });
        app.actionManager.executeAction(actionToggleElementLock);
      }}
      onWheel={(e) => {
        e.preventDefault();
      }}
    >
      {LockedIconFilled}
      <div>{t("labels.elementLock.unlock")}</div>
    </div>
  );
};

export default UnlockPopup;
