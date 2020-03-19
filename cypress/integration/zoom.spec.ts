import { baseDrawingRegion as region } from "../support/utils";

describe("Zoom", () => {
  it("should zoom a rectangle in", () => {
    // just capture an empty square on the center of the viewport
    cy.get('[title^="Rectangle"]').click();
    cy.get("#canvas").drag(
      { x: region.x + 10, y: region.y + 10 },
      { x: region.x + 50, y: region.y + 50 },
    );
    // for catching any mistake we also compare architect sloppiness
    cy.contains("Architect").click();
    cy.get('button[aria-label="Zoom in"]').click();
    cy.get("#canvas").matchImageSnapshot("rectangleZoomedIn", {
      clip: region,
    });
  });
  it("should zoom a rectangle out", () => {
    // just capture an empty square on the center of the viewport
    cy.get('[title^="Rectangle"]').click();
    cy.get("#canvas").drag(
      { x: region.x + 10, y: region.y + 10 },
      { x: region.x + 50, y: region.y + 50 },
    );
    // for catching any mistake we also compare architect sloppiness
    cy.contains("Architect").click();
    cy.get('button[aria-label="Zoom out"]').click();
    cy.get("#canvas").matchImageSnapshot("rectangleZoomedOut", {
      clip: region,
    });
  });
  // it("hit testing should work when zoomed in", () => {
  //   // just capture an empty square on the center of the viewport
  //   cy.get('[title^="Rectangle"]').click();
  //   cy.get("#canvas").drag(
  //     { x: region.x + 10, y: region.y + 10 },
  //     { x: region.x + 50, y: region.y + 50 },
  //   );
  //   cy.contains("section", "Selected shape actions").should("be.visible");
  //   cy.get("#canvas").click(region.x - 100, region.y - 100); // deselect
  //   cy.contains("section", "Selected shape actions").should("not.be.visible");
  //   cy.get('button[aria-label="Zoom in"]').click();
  //   cy.get("#canvas").click(region.x + 10, region.y + 10);
  //   cy.contains("section", "Selected shape actions").should("be.visible");
  // });
  // it("hit testing should work when zoomed out", () => {
  //   // just capture an empty square on the center of the viewport
  //   cy.get('[title^="Rectangle"]').click();
  //   cy.get("#canvas").drag(
  //     { x: region.x + 10, y: region.y + 10 },
  //     { x: region.x + 50, y: region.y + 50 },
  //   );
  //   cy.contains("section", "Selected shape actions").should("be.visible");
  //   cy.get("#canvas").click(region.x - 100, region.y - 100); // deselect
  //   cy.contains("section", "Selected shape actions").should("not.be.visible");
  //   cy.get('button[aria-label="Zoom out"]').click();
  //   cy.get("#canvas").click(region.x + 10, region.y + 10);
  //   cy.contains("section", "Selected shape actions").should("be.visible");
  // });
});
