import { ENV } from "../../constants";
if (process.env.NODE_ENV !== ENV.TEST) {
  /* eslint-disable */
  /* global __webpack_public_path__:writable */
  __webpack_public_path__ =
    window.EXCALIDRAW_ASSET_PATH ||
    `https://unpkg.com/${process.env.VITE_PKG_NAME}@${process.env.VITE_PKG_VERSION}/dist/`;
}
