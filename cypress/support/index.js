import { addMatchImageSnapshotCommand } from "cypress-image-snapshot/command";

addMatchImageSnapshotCommand({
  failureThreshold: 0.02,
  failureThresholdType: "percent",
});

beforeEach(() => {
  cy.visit("/");
  cy.get("[aria-label='Select Language']").select("English");
});

afterEach(() => {
  cy.get('button[title="Reset the canvas"]').click();
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
