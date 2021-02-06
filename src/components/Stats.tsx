import React, { useEffect, useState } from "react";
import { copyTextToSystemClipboard } from "../clipboard";
import { DEFAULT_VERSION } from "../constants";
import { getCommonBounds } from "../element/bounds";
import { NonDeletedExcalidrawElement } from "../element/types";
import {
  getElementsStorageSize,
  getTotalStorageSize,
} from "../excalidraw-app/data/localStorage";
import { t } from "../i18n";
import useIsMobile from "../is-mobile";
import { getTargetElements } from "../scene";
import { AppState } from "../types";
import { debounce, getVersion, nFormatter } from "../utils";
import { close } from "./icons";
import { Island } from "./Island";
import "./Stats.scss";

type StorageSizes = { scene: number; total: number };

const getStorageSizes = debounce((cb: (sizes: StorageSizes) => void) => {
  cb({
    scene: getElementsStorageSize(),
    total: getTotalStorageSize(),
  });
}, 500);

export const Stats = (props: {
  appState: AppState;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  onClose: () => void;
}) => {
  const isMobile = useIsMobile();
  const [storageSizes, setStorageSizes] = useState<StorageSizes>({
    scene: 0,
    total: 0,
  });

  useEffect(() => {
    getStorageSizes((sizes) => {
      setStorageSizes(sizes);
    });
  });

  useEffect(() => () => getStorageSizes.cancel(), []);

  const boundingBox = getCommonBounds(props.elements);
  const selectedElements = getTargetElements(props.elements, props.appState);
  const selectedBoundingBox = getCommonBounds(selectedElements);

  if (isMobile && props.appState.openMenu) {
    return null;
  }

  const version = getVersion();
  let hash;
  let timestamp;

  if (version !== DEFAULT_VERSION) {
    timestamp = version.slice(0, 16).replace("T", " ");
    hash = version.slice(21);
  } else {
    timestamp = t("stats.versionNotAvailable");
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
            <tr>
              <th colSpan={2}>{t("stats.storage")}</th>
            </tr>
            <tr>
              <td>{t("stats.scene")}</td>
              <td>{nFormatter(storageSizes.scene, 1)}</td>
            </tr>
            <tr>
              <td>{t("stats.total")}</td>
              <td>{nFormatter(storageSizes.total, 1)}</td>
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
                  <td>{t("stats.width")}</td>
                  <td>
                    {Math.round(
                      selectedElements.length === 1
                        ? selectedElements[0].width
                        : selectedBoundingBox[2] - selectedBoundingBox[0],
                    )}
                  </td>
                </tr>
                <tr>
                  <td>{t("stats.height")}</td>
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
            <tr>
              <th colSpan={2}>{t("stats.version")}</th>
            </tr>
            <tr>
              <td
                colSpan={2}
                style={{ textAlign: "center", cursor: "pointer" }}
                onClick={async () => {
                  try {
                    await copyTextToSystemClipboard(getVersion());
                    props.setAppState({
                      toastMessage: t("toast.copyToClipboard"),
                    });
                  } catch {}
                }}
                title={t("stats.versionCopy")}
              >
                {timestamp}
                <br />
                {hash}
              </td>
            </tr>
          </tbody>
        </table>
      </Island>
    </div>
  );
};
