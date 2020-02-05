import { addMatchImageSnapshotCommand } from "cypress-image-snapshot/command";

import "./commands";
addMatchImageSnapshotCommand({
  failureThreshold: 0.02,
  failureThresholdType: "percent",
});

beforeEach(() => {
  cy.visit("/");
  cy.get(".language-select").select("English");
});

afterEach(() => {
  cy.get('button[title="Clear the canvas & reset background color"]').click();
});

Cypress.Commands.add(
  "drag",
  { prevSubject: "element" },
  (element, start, end, button) => {
    cy.get(element)
      .trigger("mousedown", {
        button: button || 0,
        x: start.x,
        y: start.y,
      })
      .trigger("mousemove", { x: end.x, y: end.y, button: 0 })
      .trigger("mouseup");
  },
);
