import React, { useEffect, useMemo, useState } from "react";
import { getCommonBounds } from "../element/bounds";
import type { NonDeletedExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { getTargetElements } from "../scene";
import type Scene from "../scene/Scene";
import type { AppState, ExcalidrawProps } from "../types";
import { CloseIcon } from "./icons";
import { Island } from "./Island";
import "./Stats.scss";
import { throttle } from "lodash";
import DragInput from "./DragInput";

const STATS_TIMEOUT = 50;
interface StatsProps {
  appState: AppState;
  scene: Scene;
  setAppState: React.Component<any, AppState>["setState"];
  onClose: () => void;
  renderCustomStats: ExcalidrawProps["renderCustomStats"];
}

type ElementStatItem = {
  label: string;
  property: "x" | "y" | "width" | "height" | "angle";
};

export const Stats = (props: StatsProps) => {
  const elements = props.scene.getNonDeletedElements();
  const sceneNonce = props.scene.getSceneNonce();
  const selectedElements = getTargetElements(elements, props.appState);

  const singleElement =
    selectedElements.length === 1 ? selectedElements[0] : null;

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

        {singleElement && (
          <div
            className="section"
            style={{
              marginTop: 12,
            }}
          >
            <h3>{t("stats.elementStats")}</h3>

            <div className="sectionContent">
              <div className="elementType">
                {t(`element.${singleElement.type}`)}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "4px 8px",
                }}
              >
                {(
                  [
                    {
                      label: "X",
                      property: "x",
                    },
                    {
                      label: "Y",
                      property: "y",
                    },
                    {
                      label: "W",
                      property: "width",
                    },
                    {
                      label: "H",
                      property: "height",
                    },
                    {
                      label: "A",
                      property: "angle",
                    },
                  ] as ElementStatItem[]
                ).map((statsItem) => (
                  <DragInput
                    key={statsItem.label}
                    label={statsItem.label}
                    property={statsItem.property}
                    element={singleElement}
                    elementsMap={props.scene.getNonDeletedElementsMap()}
                    zoom={props.appState.zoom}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </Island>
    </div>
  );
};
