import { ENV } from "../../constants";
if (process.env.NODE_ENV !== ENV.TEST) {
  /* eslint-disable */
  /* global __webpack_public_path__:writable */
  if (process.env.NODE_ENV === ENV.DEVELOPMENT && (
    window.EXCALIDRAW_ASSET_PATH === undefined ||
    window.EXCALIDRAW_ASSET_PATH === ""
  )) {
    window.EXCALIDRAW_ASSET_PATH = "/";
  }
  __webpack_public_path__ =
    window.EXCALIDRAW_ASSET_PATH ||
    `https://unpkg.com/${process.env.PKG_NAME}@${process.env.PKG_VERSION}/dist/`;
}
