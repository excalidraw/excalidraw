import {
  diamondFixture,
  ellipseFixture,
  rectangleFixture,
} from "./elementFixture";

const diagramFixture = {
  type: "excalidraw",
  version: 2,
  source: "https://excalidraw.com",
  elements: [diamondFixture, ellipseFixture, rectangleFixture],
  appState: {
    viewBackgroundColor: "#ffffff",
    gridSize: null,
  },
};

export default diagramFixture;
