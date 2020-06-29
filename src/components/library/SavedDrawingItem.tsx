import React from "react";
import { actionAddToScene } from "../../actions/actionAddToScene";
import { useLibraryStorage, SavedDrawing } from "./storage";
import { useContext } from "react";
import { AppContext } from "../../context/AppContext";
import RenderedScene from "./RenderedScene";
import Stack from "../Stack";
import { ToolButton } from "../ToolButton";
import { addOutlined, close as closeIcon } from "../icons";
import { AppState, Point } from "../../types";
import { viewportCoordsToSceneCoords } from "../../utils";

export interface SavedDrawingItemProps {
  dialog: {
    onCloseRequest: () => void;
  };
  drawing: SavedDrawing;
}

function getSceneViewportCenter(
  appState: AppState,
  canvas: HTMLCanvasElement,
): Point {
  const { scrollX, scrollY, zoom } = appState;
  const point = viewportCoordsToSceneCoords(
    {
      clientX: window.innerWidth / 2,
      clientY: window.innerHeight / 2,
    },
    { scrollX, scrollY, zoom },
    canvas,
    1,
  );
  return [point.x, point.y];
}

/**
 * Returns a saved drawing entry which can be loaded as needed.
 */
export default function SavedDrawingItem({
  dialog,
  drawing: { uid, elements, name, lastSaved },
}: SavedDrawingItemProps) {
  const storage = useLibraryStorage();
  const { actionManager, canvas, appState } = useContext(AppContext);

  const addToScene = async () => {
    dialog.onCloseRequest();
    actionManager.executeAction(actionAddToScene, {
      elementsToAdd: elements,
      sceneCenter: getSceneViewportCenter(appState, canvas!),
    });
    await storage!.recordAccess(uid);
  };

  const remove = async () => {
    await storage?.remove({ uid });
  };

  return (
    <li className="SavedDrawingItem">
      <Stack.Col align="center" gap={1}>
        <Stack.Col className="SceneAndControls">
          <RenderedScene onClick={addToScene} elements={elements} />
          <div className="Controls">
            <ToolButton
              type="button"
              aria-label="Add to scene"
              title="Add to scene"
              icon={addOutlined}
              onClick={addToScene}
            />
            <div className="Spacer"></div>
            <ToolButton
              type="button"
              aria-label="Remove from library"
              title="Remove from library"
              icon={closeIcon}
              onClick={remove}
            />
          </div>
        </Stack.Col>
        <div className="DrawingInfo">
          <span className="DrawingName">{name || ""}</span>
          <span className="LastSaveTime">
            {new Date(lastSaved).toLocaleDateString()}{" "}
            {new Date(lastSaved).toLocaleTimeString()}
          </span>
        </div>
      </Stack.Col>
    </li>
  );
}
