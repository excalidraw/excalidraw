import { useEffect, useMemo, useState, memo } from "react";
import { getCommonBounds } from "../../element/bounds";
import type { NonDeletedExcalidrawElement } from "../../element/types";
import { t } from "../../i18n";
import type { AppState, ExcalidrawProps } from "../../types";
import { CloseIcon } from "../icons";
import { Island } from "../Island";
import { throttle } from "lodash";
import Dimension from "./Dimension";
import Angle from "./Angle";

import FontSize from "./FontSize";
import MultiDimension from "./MultiDimension";
import { elementsAreInSameGroup } from "../../groups";
import MultiAngle from "./MultiAngle";
import MultiFontSize from "./MultiFontSize";
import Position from "./Position";
import MultiPosition from "./MultiPosition";
import Collapsible from "./Collapsible";
import type Scene from "../../scene/Scene";
import { useExcalidrawAppState, useExcalidrawSetAppState } from "../App";
import { getAtomicUnits } from "./utils";
import { STATS_PANELS } from "../../constants";

interface StatsProps {
  scene: Scene;
  onClose: () => void;
  renderCustomStats: ExcalidrawProps["renderCustomStats"];
}

const STATS_TIMEOUT = 50;

export const Stats = (props: StatsProps) => {
  const appState = useExcalidrawAppState();
  const sceneNonce = props.scene.getSceneNonce() || 1;
  const selectedElements = props.scene.getSelectedElements({
    selectedElementIds: appState.selectedElementIds,
    includeBoundTextElement: false,
  });

  return (
    <StatsInner
      {...props}
      appState={appState}
      sceneNonce={sceneNonce}
      selectedElements={selectedElements}
    />
  );
};

export const StatsInner = memo(
  ({
    scene,
    onClose,
    renderCustomStats,
    selectedElements,
    appState,
    sceneNonce,
  }: StatsProps & {
    sceneNonce: number;
    selectedElements: readonly NonDeletedExcalidrawElement[];
    appState: AppState;
  }) => {
    const elements = scene.getNonDeletedElements();
    const elementsMap = scene.getNonDeletedElementsMap();
    const setAppState = useExcalidrawSetAppState();

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

    const atomicUnits = useMemo(() => {
      return getAtomicUnits(selectedElements, appState);
    }, [selectedElements, appState]);

    return (
      <div className="Stats">
        <Island padding={3}>
          <div className="title">
            <h2>{t("stats.title")}</h2>
            <div className="close" onClick={onClose}>
              {CloseIcon}
            </div>
          </div>

          <Collapsible
            label={<h3>{t("stats.generalStats")}</h3>}
            open={!!(appState.stats.panels & STATS_PANELS.generalStats)}
            openTrigger={() =>
              setAppState((state) => {
                return {
                  ...state,
                  stats: {
                    open: true,
                    panels: state.stats.panels ^ STATS_PANELS.generalStats,
                  },
                };
              })
            }
          >
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
                {renderCustomStats?.(elements, appState)}
              </tbody>
            </table>
          </Collapsible>

          {selectedElements.length > 0 && (
            <div
              id="elementStats"
              style={{
                marginTop: 12,
              }}
            >
              <Collapsible
                label={<h3>{t("stats.elementProperties")}</h3>}
                open={
                  !!(appState.stats.panels & STATS_PANELS.elementProperties)
                }
                openTrigger={() =>
                  setAppState((state) => {
                    return {
                      ...state,
                      stats: {
                        open: true,
                        panels:
                          state.stats.panels ^ STATS_PANELS.elementProperties,
                      },
                    };
                  })
                }
              >
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
                        scene={scene}
                        appState={appState}
                      />
                      <Position
                        element={singleElement}
                        property="y"
                        elementsMap={elementsMap}
                        scene={scene}
                        appState={appState}
                      />
                      <Dimension
                        property="width"
                        element={singleElement}
                        scene={scene}
                        appState={appState}
                      />
                      <Dimension
                        property="height"
                        element={singleElement}
                        scene={scene}
                        appState={appState}
                      />
                      <Angle
                        property="angle"
                        element={singleElement}
                        scene={scene}
                        appState={appState}
                      />
                      <FontSize
                        property="fontSize"
                        element={singleElement}
                        scene={scene}
                        appState={appState}
                      />
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
                        atomicUnits={atomicUnits}
                        scene={scene}
                        appState={appState}
                      />
                      <MultiPosition
                        property="y"
                        elements={multipleElements}
                        elementsMap={elementsMap}
                        atomicUnits={atomicUnits}
                        scene={scene}
                        appState={appState}
                      />
                      <MultiDimension
                        property="width"
                        elements={multipleElements}
                        elementsMap={elementsMap}
                        atomicUnits={atomicUnits}
                        scene={scene}
                        appState={appState}
                      />
                      <MultiDimension
                        property="height"
                        elements={multipleElements}
                        elementsMap={elementsMap}
                        atomicUnits={atomicUnits}
                        scene={scene}
                        appState={appState}
                      />
                      <MultiAngle
                        property="angle"
                        elements={multipleElements}
                        scene={scene}
                        appState={appState}
                      />
                      <MultiFontSize
                        property="fontSize"
                        elements={multipleElements}
                        scene={scene}
                        appState={appState}
                        elementsMap={elementsMap}
                      />
                    </div>
                  </div>
                )}
              </Collapsible>
            </div>
          )}
        </Island>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.sceneNonce === next.sceneNonce &&
      prev.selectedElements === next.selectedElements &&
      prev.appState.stats.panels === next.appState.stats.panels
    );
  },
);
