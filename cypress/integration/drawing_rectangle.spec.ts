describe("Drawing", () => {
  it("can draw a rectangle shape", () => {
    cy.visit("/");
    const width = Cypress.config("viewportWidth");
    const height = Cypress.config("viewportHeight");

    // just capture an empty square on the center of the viewport
    const region = { x: width / 2, y: height / 2, width: 100, height: 100 };
    cy.get("canvas#canvas").matchImageSnapshot("beforeBg", { clip: region });
    cy.get(".language-select").select("English");
    cy.get('input[aria-label="Canvas background"]')
      .clear()
      .type("#ffeeee");
    cy.get("canvas#canvas").matchImageSnapshot("afterBg", { clip: region });
  });
});
