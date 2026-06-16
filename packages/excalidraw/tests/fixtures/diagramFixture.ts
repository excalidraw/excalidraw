import { VERSIONS } from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import {
  diamondFixture,
  ellipseFixture,
  rectangleFixture,
} from "./elementFixture";

export const diagramFixture = {
  type: "excalidraw",
  version: VERSIONS.excalidraw,
  source: "https://excalidraw.com",
  elements: [diamondFixture, ellipseFixture, rectangleFixture],
  appState: {
    viewBackgroundColor: "#ffffff",
    gridModeEnabled: false,
  },
  files: {},
};

export const diagramFactory = ({
  overrides = {},
  elementOverrides = {},
} = {}) => ({
  ...diagramFixture,
  elements: [
    {
      ...diamondFixture,
      ...elementOverrides,
      isDeleted: false,
    } as NonDeletedExcalidrawElement,
    {
      ...ellipseFixture,
      ...elementOverrides,
      isDeleted: false,
    } as NonDeletedExcalidrawElement,
    {
      ...rectangleFixture,
      ...elementOverrides,
      isDeleted: false,
    } as NonDeletedExcalidrawElement,
  ],
  ...overrides,
});

export default diagramFixture;
