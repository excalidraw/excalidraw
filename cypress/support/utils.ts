const width = Cypress.config("viewportWidth");
const height = Cypress.config("viewportHeight");

export const baseDrawingRegion = {
  x: width / 2,
  y: height / 2,
  width: 100,
  height: 100,
};
