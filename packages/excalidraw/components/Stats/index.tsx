import React, { useEffect, useMemo, useState } from "react";
import { getCommonBounds } from "../../element/bounds";
import type { NonDeletedExcalidrawElement } from "../../element/types";
import { t } from "../../i18n";
import { getSelectedElements } from "../../scene";
import type Scene from "../../scene/Scene";
import type { AppState, ExcalidrawProps } from "../../types";
import { CloseIcon } from "../icons";
import { Island } from "../Island";
import { throttle } from "lodash";
import Dimension from "./Dimension";
import Angle from "./Angle";

import "./index.scss";
import FontSize from "./FontSize";
import MultiDimension from "./MultiDimension";
import { elementsAreInSameGroup } from "../../groups";
import MultiAngle from "./MultiAngle";
import MultiFontSize from "./MultiFontSize";
import Position from "./Position";
import MultiPosition from "./MultiPosition";

interface StatsProps {
  appState: AppState;
  scene: Scene;
  setAppState: React.Component<any, AppState>["setState"];
  onClose: () => void;
  renderCustomStats: ExcalidrawProps["renderCustomStats"];
}
const STATS_TIMEOUT = 50;

export const Stats = (props: StatsProps) => {
  const elements = props.scene.getNonDeletedElements();
  const elementsMap = props.scene.getNonDeletedElementsMap();
  const sceneNonce = props.scene.getSceneNonce();
  // const selectedElements = getTargetElements(elements, props.appState);
  const selectedElements = getSelectedElements(
    props.scene.getNonDeletedElementsMap(),
    props.appState,
    {
      includeBoundTextElement: false,
    },
  );

  const singleElement =
    selectedElements.length === 1 ? selectedElements[0] : null;

  const multipleElements =
    selectedElements.length > 1 ? selectedElements : null;

  const [sceneDimension, setSceneDimension] = useState<{
    width: number;
    height: number;
  }>({
    width: 0,
    height: 0,
  });

  const throttledSetSceneDimension = useMemo(
    () =>
      throttle((elements: readonly NonDeletedExcalidrawElement[]) => {
        const boundingBox = getCommonBounds(elements);
        setSceneDimension({
          width: Math.round(boundingBox[2]) - Math.round(boundingBox[0]),
          height: Math.round(boundingBox[3]) - Math.round(boundingBox[1]),
        });
      }, STATS_TIMEOUT),
    [],
  );

  useEffect(() => {
    throttledSetSceneDimension(elements);
  }, [sceneNonce, elements, throttledSetSceneDimension]);

  useEffect(
    () => () => throttledSetSceneDimension.cancel(),
    [throttledSetSceneDimension],
  );

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
                <td>{sceneDimension.width}</td>
              </tr>
              <tr>
                <td>{t("stats.height")}</td>
                <td>{sceneDimension.height}</td>
              </tr>
              {props.renderCustomStats?.(elements, props.appState)}
            </tbody>
          </table>
        </div>

        {selectedElements.length > 0 && (
          <div
            id="elementStats"
            className="section"
            style={{
              marginTop: 12,
            }}
          >
            <h3>{t("stats.elementStats")}</h3>

            {singleElement && (
              <div className="sectionContent">
                <div className="elementType">
                  {t(`element.${singleElement.type}`)}
                </div>

                <div className="statsItem">
                  <Position
                    element={singleElement}
                    property="x"
                    elementsMap={elementsMap}
                  />
                  <Position
                    element={singleElement}
                    property="y"
                    elementsMap={elementsMap}
                  />
                  <Dimension
                    property="width"
                    element={singleElement}
                    elementsMap={elementsMap}
                  />
                  <Dimension
                    property="height"
                    element={singleElement}
                    elementsMap={elementsMap}
                  />
                  <Angle element={singleElement} elementsMap={elementsMap} />
                  {singleElement.type === "text" && (
                    <FontSize
                      element={singleElement}
                      elementsMap={elementsMap}
                    />
                  )}
                </div>
              </div>
            )}

            {multipleElements && (
              <div className="sectionContent">
                {elementsAreInSameGroup(multipleElements) && (
                  <div className="elementType">{t("element.group")}</div>
                )}

                <div className="elementsCount">
                  <div>{t("stats.elements")}</div>
                  <div>{selectedElements.length}</div>
                </div>

                <div className="statsItem">
                  <MultiPosition
                    property="x"
                    elements={multipleElements}
                    elementsMap={elementsMap}
                  />
                  <MultiPosition
                    property="y"
                    elements={multipleElements}
                    elementsMap={elementsMap}
                  />
                  <MultiDimension
                    property="width"
                    elements={multipleElements}
                    elementsMap={elementsMap}
                    appState={props.appState}
                  />
                  <MultiDimension
                    property="height"
                    elements={multipleElements}
                    elementsMap={elementsMap}
                    appState={props.appState}
                  />
                  <MultiAngle
                    elements={multipleElements}
                    elementsMap={elementsMap}
                  />
                  <MultiFontSize
                    elements={multipleElements}
                    elementsMap={elementsMap}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Island>
    </div>
  );
};
