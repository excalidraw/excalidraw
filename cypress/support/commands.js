function normalizeCoords(coords) {
  // Note: Cypress seems to check against falsiness (thus 0 values are
  //  considered as not supplied, and position defualts to "center").
  //  Until fixed, default to `1`
  // See https://github.com/cypress-io/cypress/issues/2338
  return {
    x: coords.x || 1,
    y: coords.y || 1
  };
}

Cypress.Commands.add("pickTool", { prevSubject: false }, tool =>
  cy.contains("label", tool).click()
);

Cypress.Commands.add(
  "canvasClick",
  { prevSubject: true },
  ($canvas, coords) => {
    coords = normalizeCoords(coords);
    cy.wrap($canvas)
      .trigger("mousedown", coords.x, coords.y)
      .trigger("mouseup", coords.x, coords.y);
  }
);

Cypress.Commands.add(
  "canvasDrag",
  { prevSubject: true },
  ($canvas, startCoods, endCoords) => {
    startCoods = normalizeCoords(startCoods);
    endCoords = normalizeCoords(endCoords);

    cy.wrap($canvas)
      .trigger("mousedown", startCoods.x, startCoods.y)
      .trigger("mousemove", endCoords.x, endCoords.y)
      .trigger("mouseup", endCoords.x, endCoords.y);
  }
);
