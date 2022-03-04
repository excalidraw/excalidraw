import React from "react";
import { getCommonBounds } from "../element/bounds";
import { NonDeletedExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { useDeviceType } from "../components/App";
import { getTargetElements } from "../scene";
import { AppState, ExcalidrawProps } from "../types";
import { close } from "./icons";
import { Island } from "./Island";
import "./Stats.scss";

export const Stats = (props: {
  appState: AppState;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  onClose: () => void;
  renderCustomStats: ExcalidrawProps["renderCustomStats"];
}) => {
  const deviceType = useDeviceType();

  const boundingBox = getCommonBounds(props.elements);
  const selectedElements = getTargetElements(props.elements, props.appState);
  const selectedBoundingBox = getCommonBounds(selectedElements);

  if (deviceType.isMobile && props.appState.openMenu) {
    return null;
  }

  return (
    <div className="Stats">
      <Island padding={2}>
        <div className="close" onClick={props.onClose}>
          {close}
        </div>
        <h3>{t("stats.title")}</h3>
        <table>
          <tbody>
            <tr>
              <th colSpan={2}>{t("stats.scene")}</th>
            </tr>
            <tr>
              <td>{t("stats.elements")}</td>
              <td>{props.elements.length}</td>
            </tr>
            <tr>
              <td>{t("stats.width")}</td>
              <td>{Math.round(boundingBox[2]) - Math.round(boundingBox[0])}</td>
            </tr>
            <tr>
              <td>{t("stats.height")}</td>
              <td>{Math.round(boundingBox[3]) - Math.round(boundingBox[1])}</td>
            </tr>

            {selectedElements.length === 1 && (
              <tr>
                <th colSpan={2}>{t("stats.element")}</th>
              </tr>
            )}

            {selectedElements.length > 1 && (
              <>
                <tr>
                  <th colSpan={2}>{t("stats.selected")}</th>
                </tr>
                <tr>
                  <td>{t("stats.elements")}</td>
                  <td>{selectedElements.length}</td>
                </tr>
              </>
            )}
            {selectedElements.length > 0 && (
              <>
                <tr>
                  <td>{"x"}</td>
                  <td>{Math.round(selectedBoundingBox[0])}</td>
                </tr>
                <tr>
                  <td>{"y"}</td>
                  <td>{Math.round(selectedBoundingBox[1])}</td>
                </tr>
                <tr>
                  <td>{t("stats.width")}</td>
                  <td>
                    {Math.round(
                      selectedBoundingBox[2] - selectedBoundingBox[0],
                    )}
                  </td>
                </tr>
                <tr>
                  <td>{t("stats.height")}</td>
                  <td>
                    {Math.round(
                      selectedBoundingBox[3] - selectedBoundingBox[1],
                    )}
                  </td>
                </tr>
              </>
            )}
            {selectedElements.length === 1 && (
              <tr>
                <td>{t("stats.angle")}</td>
                <td>
                  {`${Math.round(
                    (selectedElements[0].angle * 180) / Math.PI,
                  )}°`}
                </td>
              </tr>
            )}
            {props.renderCustomStats?.(props.elements, props.appState)}
          </tbody>
        </table>
      </Island>
    </div>
  );
};
