import React from "react";
import { getCommonBounds } from "../element/bounds";
import { NonDeletedExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { AppState, ExcalidrawProps } from "../types";
import { CloseIcon } from "./icons";
import { Island } from "./Island";
import "./Stats.scss";

export const Stats = (props: {
  appState: AppState;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  onClose: () => void;
  renderCustomStats: ExcalidrawProps["renderCustomStats"];
}) => {
  const boundingBox = getCommonBounds(props.elements);

  return (
    <div className="Stats">
      <Island padding={2}>
        <div className="close" onClick={props.onClose}>
          {CloseIcon}
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
            {props.renderCustomStats?.(props.elements, props.appState)}
          </tbody>
        </table>
      </Island>
    </div>
  );
};
