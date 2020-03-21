import { baseDrawingRegion as region } from "../support/utils";

describe("Panning", () => {
  it("should change cursor when pressing space key", () => {
    // Initial cursor
    cy.get("#canvas").should("have.css", "cursor", "auto");
    // Holding the space key down
    cy.get("#canvas").trigger("keydown", { key: " " });
    cy.get("#canvas").should("have.css", "cursor", "grabbing");
    // Releasing the space key
    cy.get("#canvas").trigger("keyup", { key: " " });
    cy.get("#canvas").should("have.css", "cursor", "auto");
  });
  it("should change cursor to crosshair after releasing space key after choosing a tool", () => {
    // Initial cursor
    cy.get("#canvas").should("have.css", "cursor", "auto");
    // Holding the space key down
    cy.get("#canvas").trigger("keydown", { key: " " });
    cy.get("#canvas").should("have.css", "cursor", "grabbing");
    cy.get('[title^="Rectangle"]').click();
    // Releasing the space key
    cy.get("#canvas").trigger("keyup", { key: " " });
    cy.get("#canvas").should("have.css", "cursor", "crosshair");
  });
  it("should pan away from rectangle using space + drag technique", () => {
    cy.get('[title^="Rectangle"]').click();
    cy.get("#canvas").drag(
      { x: region.x + 10, y: region.y + 10 },
      { x: region.x + 50, y: region.y + 50 },
    );
    cy.get("#canvas").click(region.x - 50, region.y - 50); // deselect
    cy.get("#canvas").matchImageSnapshot("beforePanningRectangle", {
      clip: region,
    });
    // pan
    cy.get("#canvas").trigger("keydown", { key: " " });
    cy.get("#canvas").drag(
      { x: region.x, y: region.y },
      { x: region.x + 20, y: region.y + 15 },
    );
    cy.get("#canvas").click(region.x - 50, region.y - 50); // deselect
    cy.get("#canvas").matchImageSnapshot("afterPanningRectangle", {
      clip: region,
    });
  });
  it("should pan away from rectangle using wheel", () => {
    cy.get('[title^="Rectangle"]').click();
    cy.get("#canvas").drag(
      { x: region.x + 10, y: region.y + 10 },
      { x: region.x + 50, y: region.y + 50 },
    );
    cy.get("#canvas").click(region.x - 50, region.y - 50); // deselect
    // we add some tolerance threshold due to rough.js randomness
    cy.get("#canvas").matchImageSnapshot("beforePanningRectangleWheel", {
      clip: region,
    });
    // pan
    cy.get("#canvas").drag(
      { x: region.x, y: region.y },
      { x: region.x + 17, y: region.y + 18 },
      1,
    );
    cy.get("#canvas").click(region.x - 50, region.y - 50); // deselect
    cy.get("#canvas").matchImageSnapshot("afterPanningRectangleWheel", {
      clip: region,
    });
  });
});
