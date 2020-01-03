import { tools } from "../support/constants.js";

describe("Drawing elements", () => {
  it("should draw rectangle", () => {
    cy.visit("/");
    cy.viewport(600, 600);
    cy.pickTool(tools.rectangle);
    cy.get("#canvas").canvasDrag({ x: 50, y: 50 }, { x: 100, y: 100 });
  });
});
