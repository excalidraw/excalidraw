import {
  baseDrawingRegion as region,
  artistDrawingConfig,
} from "../support/utils";

describe("Lock tool", () => {
  it("shouldn't create more than one shape if the lock is not active", () => {
    cy.get(
      'input[aria-label="Keep selected tool active after drawing"]',
    ).should("not.be.checked");
    cy.get('[title^="Rectangle"]').click();
    cy.contains("Architect").click();
    cy.get("#canvas").drag(
      { x: region.x + 10, y: region.y + 10 },
      { x: region.x + 40, y: region.y + 50 },
    );
    cy.get("#canvas").drag(
      { x: region.x + 50, y: region.y + 10 },
      { x: region.x + 80, y: region.y + 50 },
    );
    cy.get("#canvas").matchImageSnapshot("rectangleUnlocked", {
      clip: region,
      ...artistDrawingConfig,
    });
  });
  it("should create two shapes if the lock is active", () => {
    cy.get(
      'input[aria-label="Keep selected tool active after drawing"]',
    ).click({ force: true });
    cy.get('[title^="Rectangle"]').click();
    cy.contains("Architect").click();
    cy.get("#canvas").drag(
      { x: region.x + 10, y: region.y + 10 },
      { x: region.x + 40, y: region.y + 50 },
    );
    cy.get("#canvas").drag(
      { x: region.x + 50, y: region.y + 10 },
      { x: region.x + 80, y: region.y + 50 },
    );
    cy.get("#canvas").matchImageSnapshot("rectangleLocked", {
      clip: region,
      ...artistDrawingConfig,
    });
  });
});
