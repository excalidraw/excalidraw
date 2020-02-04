describe("Drawing", () => {
  let width = 0;
  let height = 0;
  before(() => {
    width = Cypress.config("viewportWidth");
    height = Cypress.config("viewportHeight");
  });
  beforeEach(() => {
    cy.visit("/");
    cy.get(".language-select").select("English");
  });
  afterEach(() => {
    cy.get('button[title="Clear the canvas & reset background color"]').click();
  });
  it("changes canvas background color", () => {
    // just capture an empty square on the center of the viewport
    const region = { x: width / 2, y: height / 2, width: 100, height: 100 };
    cy.get("canvas#canvas").matchImageSnapshot("beforeBg", { clip: region });
    cy.get('input[aria-label="Canvas background"]')
      .clear()
      .type("#ffeeee");
    cy.get("canvas#canvas").matchImageSnapshot("afterBg", { clip: region });
    // restore background
    cy.get('input[aria-label="Canvas background"]')
      .clear()
      .type("#ffffff");
  });
  it("draws rectangle", () => {
    // just capture an empty square on the center of the viewport
    const region = { x: width / 2, y: height / 2, width: 100, height: 100 };
    cy.get('input[aria-label="Rectangle"]').click();
    cy.get("canvas#canvas")
      .trigger("mousedown", {
        button: 0,
        x: region.x + 10,
        y: region.y + 10,
      })
      .trigger("mousemove", { x: region.x + 50, y: region.y + 50, button: 0 })
      .trigger("mouseup");
    // we add some tolerance threshold due to rough.js randomness
    cy.get("canvas#canvas").matchImageSnapshot("rectangleArtist", {
      clip: region,
      failureThreshold: 0.03,
      failureThresholdType: "percent",
    });
    // for catching any mistake we also compare architect sloppiness
    cy.contains("Architect").click();
    cy.get("canvas#canvas").matchImageSnapshot("rectangleArchitect", {
      clip: region,
    });
  });
  it("writes text using text tool", () => {
    // just capture an empty square on the center of the viewport
    const region = { x: width / 2, y: height / 2, width: 100, height: 100 };
    cy.get('input[aria-label="Text"]').click();
    cy.get("canvas#canvas").trigger("mousedown", {
      button: 0,
      x: region.x,
      y: region.y,
    });
    cy.get('[contenteditable="true"]')
      .type("Hello world!")
      .blur();
    // shift screenshot region due to text being shifted while typing
    const screenshotRegion = {
      x: region.x - 100,
      y: region.y - 50,
      width: 200,
      height: 100,
    };
    cy.get("canvas#canvas").matchImageSnapshot("textTool", {
      clip: screenshotRegion,
    });
  });
  it("writes text by double clicking", () => {
    // just capture an empty square on the center of the viewport
    const region = { x: width / 2, y: height / 2, width: 100, height: 100 };
    cy.get("canvas#canvas").trigger("dblclick", region.x, region.y);
    cy.get('[contenteditable="true"]')
      .type("Hello world!")
      .blur();
    // shift screenshot region due to text being shifted while typing
    const screenshotRegion = {
      x: region.x - 100,
      y: region.y - 50,
      width: 200,
      height: 100,
    };
    cy.get("canvas#canvas").matchImageSnapshot("textDblClick", {
      clip: screenshotRegion,
    });
  });
});
