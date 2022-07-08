import { ENV } from "../../constants";
if (process.env.NODE_ENV !== ENV.TEST) {
  /* eslint-disable */
  /* global __webpack_public_path__:writable */
  __webpack_public_path__ =
    window.EXCALIDRAW_PLUGINS_ASSET_PATH ||
    `https://unpkg.com/${process.env.PKG_NAME}@${process.env.PKG_VERSION}/dist/`;
}
