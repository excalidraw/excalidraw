import "./StatsForNerds.scss";

import React, { useEffect, useState } from "react";
import { AppState } from "../types";
import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "../element/types";
import { getCommonBoundingBox } from "../element/bounds";
import { getSelectedElements } from "../scene";
import {
  getElementsStorageSize,
  getTotalStorageSize,
} from "../excalidraw-app/data/localStorage";
import { debounce, nFormatter } from "../utils";
import { close } from "./icons";

type StorageSizes = { scene: number; total: number };

const getStorageSizes = debounce((cb: (sizes: StorageSizes) => void) => {
  cb({
    scene: getElementsStorageSize(),
    total: getTotalStorageSize(),
  });
}, 500);

export const StatsForNerds = (props: {
  appState: AppState;
  elements: readonly NonDeletedExcalidrawElement[];
}) => {
  const [storageSizes, setStorageSizes] = useState<StorageSizes>({
    scene: 0,
    total: 0,
  });

  useEffect(() => {
    getStorageSizes((sizes) => {
      setStorageSizes(sizes);
    });
  });

  const boundingBox = getCommonBoundingBox(
    props.elements as ExcalidrawElement[],
  );

  const selectedElements = getSelectedElements(props.elements, props.appState);

  const selectedBoundingBox = getCommonBoundingBox(selectedElements);
  return (
    <div className="StatsForNerds">
      <div className={"close"}>{close}</div>
      <h3>{"Stats for nerds"}</h3>
      <table>
        <tbody>
          <tr>
            <th colSpan={2}>{"Scene"}</th>
          </tr>
          <tr>
            <td>{"Elements"}</td>
            <td>{props.elements.length}</td>
          </tr>
          <tr>
            <td>{"Width"}</td>
            <td>{Math.round(boundingBox[2]) - Math.round(boundingBox[0])}</td>
          </tr>
          <tr>
            <td>{"Height"}</td>
            <td>{Math.round(boundingBox[3]) - Math.round(boundingBox[1])}</td>
          </tr>
          <tr>
            <th colSpan={2}>{"Storage"}</th>
          </tr>
          <tr>
            <td>{"Scene"}</td>
            <td>{nFormatter(storageSizes.scene, 1)}</td>
          </tr>
          <tr>
            <td>{"Total"}</td>
            <td>{nFormatter(storageSizes.total, 1)}</td>
          </tr>

          {selectedElements.length === 1 && (
            <>
              <tr>
                <th colSpan={2}>{"Element"}</th>
              </tr>
            </>
          )}

          {selectedElements.length > 1 && (
            <>
              <tr>
                <th colSpan={2}>{"Selection"}</th>
              </tr>
              <tr>
                <td>{"Elements"}</td>
                <td>{selectedElements.length}</td>
              </tr>
            </>
          )}
          {selectedElements.length > 0 && (
            <>
              <tr>
                <td>{"x"}</td>
                <td>
                  {Math.round(
                    selectedElements.length === 1
                      ? selectedElements[0].x
                      : selectedBoundingBox[0],
                  )}
                </td>
              </tr>
              <tr>
                <td>{"y"}</td>
                <td>
                  {Math.round(
                    selectedElements.length === 1
                      ? selectedElements[0].y
                      : selectedBoundingBox[1],
                  )}
                </td>
              </tr>
              <tr>
                <td>{"Width"}</td>
                <td>
                  {Math.round(
                    selectedElements.length === 1
                      ? selectedElements[0].width
                      : selectedBoundingBox[2] - selectedBoundingBox[0],
                  )}
                </td>
              </tr>
              <tr>
                <td>{"Height"}</td>
                <td>
                  {Math.round(
                    selectedElements.length === 1
                      ? selectedElements[0].height
                      : selectedBoundingBox[3] - selectedBoundingBox[1],
                  )}
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
};
