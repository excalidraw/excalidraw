import React from "react";
import { getCommonBounds } from "../element/bounds";
import { mutateElement } from "../element/mutateElement";
import { ExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { KEYS } from "../keys";
import { getTargetElements } from "../scene";
import Scene from "../scene/Scene";
import { AppState, ExcalidrawProps } from "../types";
import { CloseIcon } from "./icons";
import { Island } from "./Island";
import "./Stats.scss";

interface StatsProps {
  appState: AppState;
  scene: Scene;
  setAppState: React.Component<any, AppState>["setState"];
  onClose: () => void;
  renderCustomStats: ExcalidrawProps["renderCustomStats"];
}

export const Stats = (props: StatsProps) => {
  const elements = props.scene.getNonDeletedElements();
  const boundingBox = getCommonBounds(elements);
  const selectedElements = getTargetElements(elements, props.appState);
  const selectedBoundingBox = getCommonBounds(selectedElements);

  const stats =
    selectedElements.length === 1
      ? [
          {
            label: "X",
            value: Math.round(selectedBoundingBox[0]),
            element: selectedElements[0],
            property: "x",
          },
          {
            label: "Y",
            value: Math.round(selectedBoundingBox[1]),
            element: selectedElements[0],
            property: "y",
          },
          {
            label: "W",
            value: Math.round(selectedBoundingBox[2] - selectedBoundingBox[0]),
            element: selectedElements[0],
            property: "width",
          },
          {
            label: "H",
            value: Math.round(selectedBoundingBox[3] - selectedBoundingBox[1]),
            element: selectedElements[0],
            property: "height",
          },
          {
            label: "A",
            value: selectedElements[0].angle,
            element: selectedElements[0],
            property: "angle",
          },
        ]
      : [];

  return (
    <div className="Stats">
      <Island padding={3}>
        <div className="section">
          <div className="close" onClick={props.onClose}>
            {CloseIcon}
          </div>
          <h3>{t("stats.generalStats")}</h3>
          <table>
            <tbody>
              <tr>
                <th colSpan={2}>{t("stats.scene")}</th>
              </tr>
              <tr>
                <td>{t("stats.elements")}</td>
                <td>{elements.length}</td>
              </tr>
              <tr>
                <td>{t("stats.width")}</td>
                <td>
                  {Math.round(boundingBox[2]) - Math.round(boundingBox[0])}
                </td>
              </tr>
              <tr>
                <td>{t("stats.height")}</td>
                <td>
                  {Math.round(boundingBox[3]) - Math.round(boundingBox[1])}
                </td>
              </tr>
              {props.renderCustomStats?.(elements, props.appState)}
            </tbody>
          </table>
        </div>

        {selectedElements.length > 0 && (
          <div className="section">
            <h3>{t("stats.elementStats")}</h3>

            <div className="sectionContent">
              {selectedElements.length === 1 && (
                <div className="elementType">
                  {t(`element.${selectedElements[0].type}`)}
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "4px 8px",
                }}
              >
                {stats.map((statsItem) => (
                  <label
                    className="color-input-container"
                    key={statsItem.property}
                  >
                    <div
                      className="color-picker-hash"
                      style={{
                        width: "30px",
                      }}
                    >
                      {statsItem.label}
                    </div>
                    <input
                      id={statsItem.label}
                      key={statsItem.value}
                      defaultValue={statsItem.value}
                      className="color-picker-input"
                      style={{
                        width: "55px",
                      }}
                      autoComplete="off"
                      spellCheck="false"
                      onKeyDown={(event) => {
                        const value = Number(event.target.value);

                        if (event.key === KEYS.ENTER) {
                          if (!isNaN(value)) {
                            mutateElement(statsItem.element, {
                              [statsItem.property]: value,
                            });
                          }

                          event.target.value = statsItem.element[
                            statsItem.property as keyof ExcalidrawElement
                          ] as string;
                        }
                      }}
                      onBlur={(event) => {
                        const value = Number(event.target.value);

                        if (!isNaN(value)) {
                          mutateElement(statsItem.element, {
                            [statsItem.property]: value,
                          });
                        }

                        event.target.value = statsItem.element[
                          statsItem.property as keyof ExcalidrawElement
                        ] as string;
                      }}
                    ></input>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </Island>
    </div>
  );
};
