import ExcalidrawApp from "../excalidraw-app";
import { t } from "../i18n";
import { CODES } from "../keys";
import { API } from "../tests/helpers/api";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import { fireEvent, render, screen } from "../tests/test-utils";
import { copiedStyles } from "./actionStyles";

const { h } = window;

const mouse = new Pointer("mouse");

describe("actionStyles", () => {
  beforeEach(async () => {
    await render(<ExcalidrawApp />);
  });
  
  it("should copy & paste styles via keyboard", () => {
    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(20, 20);

    // Change some styles of second rectangle
    UI.clickLabeledElement("Stroke");
    UI.clickLabeledElement(t("colors.c92a2a"));
    UI.clickLabeledElement("Background");
    UI.clickLabeledElement(t("colors.e64980"));
    // Fill style
    fireEvent.click(screen.getByTitle("Cross-hatch"));
    // Stroke width
    fireEvent.click(screen.getByTitle("Bold"));
    // Stroke style
    fireEvent.click(screen.getByTitle("Dotted"));
    // Roughness
    fireEvent.click(screen.getByTitle("Cartoonist"));
    // Opacity
    fireEvent.change(screen.getByLabelText("Opacity"), {
      target: { value: "60" },
    });

    mouse.reset();

    API.setSelectedElements([h.elements[1]]);

    Keyboard.withModifierKeys({ ctrl: true, alt: true }, () => {
      Keyboard.codeDown(CODES.C);
    });
    const secondRect = JSON.parse(copiedStyles);
    expect(secondRect.id).toBe(h.elements[1].id);

    mouse.reset();
    // Paste styles to first rectangle
    API.setSelectedElements([h.elements[0]]);
    Keyboard.withModifierKeys({ ctrl: true, alt: true }, () => {
      Keyboard.codeDown(CODES.V);
    });

    const firstRect = API.getSelectedElement();
    expect(firstRect.id).toBe(h.elements[0].id);
    expect(firstRect.strokeColor).toBe("#c92a2a");
    expect(firstRect.backgroundColor).toBe("#e64980");
    expect(firstRect.fillStyle).toBe("cross-hatch");
    expect(firstRect.strokeWidth).toBe(2); // Bold: 2
    expect(firstRect.strokeStyle).toBe("dotted");
    expect(firstRect.roughness).toBe(2); // Cartoonist: 2
    expect(firstRect.opacity).toBe(60);
  });
});
