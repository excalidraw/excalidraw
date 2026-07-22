import { VERSIONS } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

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
  elementOverrides = {} as Partial<ExcalidrawElement>,
} = {}) => ({
  ...diagramFixture,
  elements: [
    {
      ...diamondFixture,
      ...elementOverrides,
      isDeleted: elementOverrides.isDeleted ?? false,
    } as NonDeletedExcalidrawElement,
    {
      ...ellipseFixture,
      ...elementOverrides,
      isDeleted: elementOverrides.isDeleted ?? false,
    } as NonDeletedExcalidrawElement,
    {
      ...rectangleFixture,
      ...elementOverrides,
      isDeleted: elementOverrides.isDeleted ?? false,
    } as NonDeletedExcalidrawElement,
  ],
  ...overrides,
});

export default diagramFixture;
