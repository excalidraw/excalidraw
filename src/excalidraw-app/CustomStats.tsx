import { useEffect, useState } from "react";
import { debounce, getVersion, nFormatter } from "../utils";
import {
  getElementsStorageSize,
  getTotalStorageSize,
} from "./data/localStorage";
import { DEFAULT_VERSION } from "../constants";
import { t } from "../i18n";
import { copyTextToSystemClipboard } from "../clipboard";
import { AppState } from "../types";
import { NonDeletedExcalidrawElement } from "../element/types";
type StorageSizes = { scene: number; total: number };

const STORAGE_SIZE_TIMEOUT = 500;

const getStorageSizes = debounce((cb: (sizes: StorageSizes) => void) => {
  cb({
    scene: getElementsStorageSize(),
    total: getTotalStorageSize(),
  });
}, STORAGE_SIZE_TIMEOUT);

type Props = {
  setToast: (message: string) => void;
  elements: readonly NonDeletedExcalidrawElement[];
  appState: AppState;
};
const CustomStats = (props: Props) => {
  const [storageSizes, setStorageSizes] = useState<StorageSizes>({
    scene: 0,
    total: 0,
  });

  useEffect(() => {
    getStorageSizes((sizes) => {
      setStorageSizes(sizes);
    });
  }, [props.elements, props.appState]);
  useEffect(() => () => getStorageSizes.cancel(), []);

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
    <>
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
              props.setToast(t("toast.copyToClipboard"));
            } catch {}
          }}
          title={t("stats.versionCopy")}
        >
          {timestamp}
          <br />
          {hash}
        </td>
      </tr>
    </>
  );
};

export default CustomStats;
