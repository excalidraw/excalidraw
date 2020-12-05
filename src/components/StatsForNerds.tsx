import "./StatsForNerds.scss";

import React from "react";
import { AppState } from "../types";
import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "../element/types";
import { getCommonBoundingBox } from "../element/bounds";
import { getSelectedElements } from "../scene";

type StatsForNerdsProps = {
  appState: AppState;
  elements: readonly NonDeletedExcalidrawElement[];
};

export class StatsForNerds extends React.Component<StatsForNerdsProps> {
  public render() {
    const boundingBox = getCommonBoundingBox(
      this.props.elements as ExcalidrawElement[],
    );

    const selectedElements = getSelectedElements(
      this.props.elements,
      this.props.appState,
    );

    const selectedBoundingBox = getCommonBoundingBox(selectedElements);
    return (
      <div className="StatsForNerds">
        <h3>{"Stats for nerds"}</h3>
        <table>
          <tr>
            <th colSpan={2}>{"Scene"}</th>
          </tr>
          <tr>
            <td>{"Elements"}</td>
            <td>{this.props.elements.length}</td>
          </tr>
          <tr>
            <td>{"Height"}</td>
            <td>{Math.round(boundingBox[2]) - Math.round(boundingBox[0])}</td>
          </tr>
          <tr>
            <td>{"Width"}</td>
            <td>{Math.round(boundingBox[3]) - Math.round(boundingBox[1])}</td>
          </tr>

          {selectedElements.length > 0 && (
            <>
              <tr>
                <th colSpan={2}>{"Selection"}</th>
              </tr>
              <tr>
                <td>{"Elements"}</td>
                <td>{selectedElements.length}</td>
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
        </table>
      </div>
    );
  }
}
