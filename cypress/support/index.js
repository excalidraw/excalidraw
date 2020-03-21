import { addMatchImageSnapshotCommand } from "cypress-image-snapshot/command";

addMatchImageSnapshotCommand({
  failureThreshold: 0,
  failureThresholdType: "percent",
});

// https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript/47593316#47593316
const LCG = seed => () =>
  ((2 ** 31 - 1) & (seed = Math.imul(48271, seed))) / 2 ** 31;

const MathRandom = Math.random;
beforeEach(() => {
  Math.random = LCG(0);
  cy.visit("/");
  cy.get("[aria-label='Select Language']").select("English");
});

afterEach(() => {
  Math.random = MathRandom;
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
