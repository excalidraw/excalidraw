import { nanoid } from "nanoid";
import React, { useEffect, useMemo, useState } from "react";
import { getCommonBounds } from "../element/bounds";
import { mutateElement } from "../element/mutateElement";
import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "../element/types";
import { t } from "../i18n";
import { KEYS } from "../keys";
import { degreeToRadian, radianToDegree } from "../math";
import { getTargetElements } from "../scene";
import Scene from "../scene/Scene";
import { AppState, ExcalidrawProps } from "../types";
import { CloseIcon } from "./icons";
import { Island } from "./Island";
import "./Stats.scss";
import { throttle } from "lodash";

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
  value: number;
  element: NonDeletedExcalidrawElement;
  version: string;
  property: "x" | "y" | "width" | "height" | "angle";
};

export const Stats = (props: StatsProps) => {
  const elements = props.scene.getNonDeletedElements();
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
  }, [props.scene.version, elements, throttledSetSceneDimension]);

  useEffect(
    () => () => throttledSetSceneDimension.cancel(),
    [throttledSetSceneDimension],
  );

  const [elementStats, setElementStats] = useState<ElementStatItem[]>([]);

  const throttledSetElementStats = useMemo(
    () =>
      throttle((element: NonDeletedExcalidrawElement | null) => {
        const stats: ElementStatItem[] = element
          ? [
              {
                label: "X",
                value: Math.round(element.x),
                element,
                property: "x",
                version: nanoid(),
              },
              {
                label: "Y",
                value: Math.round(element.y),
                element,
                property: "y",
                version: nanoid(),
              },
              {
                label: "W",
                value: Math.round(element.width),
                element,
                property: "width",
                version: nanoid(),
              },
              {
                label: "H",
                value: Math.round(element.height),
                element,
                property: "height",
                version: nanoid(),
              },
              {
                label: "A",
                value: Math.round(radianToDegree(element.angle) * 100) / 100,
                element,
                property: "angle",
                version: nanoid(),
              },
            ]
          : [];

        setElementStats(stats);
      }, STATS_TIMEOUT),
    [],
  );

  useEffect(() => {
    throttledSetElementStats(singleElement);
  }, [
    singleElement,
    singleElement?.version,
    singleElement?.versionNonce,
    throttledSetElementStats,
  ]);

  useEffect(
    () => () => throttledSetElementStats.cancel(),
    [throttledSetElementStats],
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
                {elementStats.map((statsItem) => {
                  return (
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
                        key={statsItem.version}
                        defaultValue={statsItem.value}
                        className="color-picker-input"
                        style={{
                          width: "55px",
                        }}
                        autoComplete="off"
                        spellCheck="false"
                        onKeyDown={(event) => {
                          let value = Number(event.target.value);

                          if (isNaN(value)) {
                            return;
                          }

                          value =
                            statsItem.property === "angle"
                              ? degreeToRadian(value)
                              : value;

                          if (event.key === KEYS.ENTER) {
                            mutateElement(statsItem.element, {
                              [statsItem.property]: value,
                            });

                            event.target.value = statsItem.element[
                              statsItem.property as keyof ExcalidrawElement
                            ] as string;
                          }
                        }}
                        onBlur={(event) => {
                          let value = Number(event.target.value);

                          if (isNaN(value)) {
                            return;
                          }

                          value =
                            statsItem.property === "angle"
                              ? degreeToRadian(value)
                              : value;

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
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Island>
    </div>
  );
};
