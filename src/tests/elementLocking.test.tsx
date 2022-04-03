import ReactDOM from "react-dom";
import ExcalidrawApp from "../excalidraw-app";
import { render } from "../tests/test-utils";
import { Keyboard, Pointer, UI } from "../tests/helpers/ui";
import { KEYS } from "../keys";
import { API } from "../tests/helpers/api";
import { actionSelectAll } from "../actions";
import { t } from "../i18n";
import { mutateElement } from "../element/mutateElement";

ReactDOM.unmountComponentAtNode(document.getElementById("root")!);

const mouse = new Pointer("mouse");
const h = window.h;

describe("element locking", () => {
  beforeEach(async () => {
    await render(<ExcalidrawApp />);
    h.elements = [];
  });

  it("click-selecting a locked element is disabled", () => {
    const lockedRectangle = API.createElement({
      type: "rectangle",
      width: 100,
      backgroundColor: "red",
      fillStyle: "solid",
      locked: true,
    });

    h.elements = [lockedRectangle];

    mouse.clickAt(50, 50);
    expect(API.getSelectedElements().length).toBe(0);
  });

  it("box-selecting a locked element is disabled", () => {
    const lockedRectangle = API.createElement({
      type: "rectangle",
      width: 100,
      backgroundColor: "red",
      fillStyle: "solid",
      locked: true,
      x: 100,
      y: 100,
    });

    h.elements = [lockedRectangle];

    mouse.downAt(50, 50);
    mouse.moveTo(250, 250);
    mouse.upAt(250, 250);
    expect(API.getSelectedElements().length).toBe(0);
  });

  it("dragging a locked element is disabled", () => {
    const lockedRectangle = API.createElement({
      type: "rectangle",
      width: 100,
      backgroundColor: "red",
      fillStyle: "solid",
      locked: true,
    });

    h.elements = [lockedRectangle];

    mouse.downAt(50, 50);
    mouse.moveTo(100, 100);
    mouse.upAt(100, 100);
    expect(lockedRectangle).toEqual(expect.objectContaining({ x: 0, y: 0 }));
  });

  it("you can drag element that's below a locked element", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      width: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const lockedRectangle = API.createElement({
      type: "rectangle",
      width: 100,
      backgroundColor: "red",
      fillStyle: "solid",
      locked: true,
    });

    h.elements = [rectangle, lockedRectangle];

    mouse.downAt(50, 50);
    mouse.moveTo(100, 100);
    mouse.upAt(100, 100);
    expect(lockedRectangle).toEqual(expect.objectContaining({ x: 0, y: 0 }));
    expect(rectangle).toEqual(expect.objectContaining({ x: 50, y: 50 }));
    expect(API.getSelectedElements().length).toBe(1);
    expect(API.getSelectedElement().id).toBe(rectangle.id);
  });

  it("selectAll shouldn't select locked elements", () => {
    h.elements = [
      API.createElement({ type: "rectangle" }),
      API.createElement({ type: "rectangle", locked: true }),
    ];
    h.app.actionManager.executeAction(actionSelectAll);
    expect(API.getSelectedElements().length).toBe(1);
  });

  it("clicking on a locked element should select the unlocked element beneath it", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      width: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const lockedRectangle = API.createElement({
      type: "rectangle",
      width: 100,
      backgroundColor: "red",
      fillStyle: "solid",
      locked: true,
    });

    h.elements = [rectangle, lockedRectangle];
    expect(API.getSelectedElements().length).toBe(0);
    mouse.clickAt(50, 50);
    expect(API.getSelectedElements().length).toBe(1);
    expect(API.getSelectedElement().id).toBe(rectangle.id);
  });

  it("right-clicking on a locked element should select it & open its contextMenu", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      width: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const lockedRectangle = API.createElement({
      type: "rectangle",
      width: 100,
      backgroundColor: "red",
      fillStyle: "solid",
      locked: true,
    });

    h.elements = [rectangle, lockedRectangle];
    expect(API.getSelectedElements().length).toBe(0);
    mouse.rightClickAt(50, 50);
    expect(API.getSelectedElements().length).toBe(1);
    expect(API.getSelectedElement().id).toBe(lockedRectangle.id);

    const contextMenu = UI.queryContextMenu();
    expect(contextMenu).not.toBeNull();
    expect(
      contextMenu?.querySelector(
        `li[data-testid="toggleLock"] .context-menu-option__label`,
      ),
    ).toHaveTextContent(t("labels.lock.unlock"));
  });

  it("right-clicking on element covered by locked element should ignore the locked element", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      width: 100,
      backgroundColor: "red",
      fillStyle: "solid",
    });
    const lockedRectangle = API.createElement({
      type: "rectangle",
      width: 100,
      backgroundColor: "red",
      fillStyle: "solid",
      locked: true,
    });

    h.elements = [rectangle, lockedRectangle];
    API.setSelectedElements([rectangle]);
    expect(API.getSelectedElements().length).toBe(1);
    expect(API.getSelectedElement().id).toBe(rectangle.id);
    mouse.rightClickAt(50, 50);
    expect(API.getSelectedElements().length).toBe(1);
    expect(API.getSelectedElement().id).toBe(rectangle.id);

    const contextMenu = UI.queryContextMenu();
    expect(contextMenu).not.toBeNull();
  });

  it("selecting a group selects all elements including locked ones", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      width: 100,
      backgroundColor: "red",
      fillStyle: "solid",
      groupIds: ["g1"],
    });
    const lockedRectangle = API.createElement({
      type: "rectangle",
      width: 100,
      backgroundColor: "red",
      fillStyle: "solid",
      locked: true,
      groupIds: ["g1"],
      x: 200,
      y: 200,
    });

    h.elements = [rectangle, lockedRectangle];

    mouse.clickAt(250, 250);
    expect(API.getSelectedElements().length).toBe(0);

    mouse.clickAt(50, 50);
    expect(API.getSelectedElements().length).toBe(2);
  });

  it("should ignore locked text element in center of container on ENTER", () => {
    const container = API.createElement({
      type: "rectangle",
      width: 100,
    });
    const textSize = 20;
    const text = API.createElement({
      type: "text",
      text: "ola",
      x: container.width / 2 - textSize / 2,
      y: container.height / 2 - textSize / 2,
      width: textSize,
      height: textSize,
      containerId: container.id,
      locked: true,
    });
    h.elements = [container, text];
    API.setSelectedElements([container]);
    Keyboard.keyPress(KEYS.ENTER);
    expect(h.state.editingElement?.id).not.toBe(text.id);
    expect(h.state.editingElement?.id).toBe(h.elements[2].id);
  });

  it("should ignore locked text under cursor when clicked with text tool", () => {
    const text = API.createElement({
      type: "text",
      text: "ola",
      x: 60,
      y: 0,
      width: 100,
      height: 100,
      locked: true,
    });
    h.elements = [text];
    UI.clickTool("text");
    mouse.clickAt(text.x + 50, text.y + 50);
    const editor = document.querySelector(
      ".excalidraw-textEditorContainer > textarea",
    ) as HTMLTextAreaElement;
    expect(editor).not.toBe(null);
    expect(h.state.editingElement?.id).not.toBe(text.id);
    expect(h.elements.length).toBe(2);
    expect(h.state.editingElement?.id).toBe(h.elements[1].id);
  });

  it("should ignore text under cursor when double-clicked with selection tool", () => {
    const text = API.createElement({
      type: "text",
      text: "ola",
      x: 60,
      y: 0,
      width: 100,
      height: 100,
      locked: true,
    });
    h.elements = [text];
    UI.clickTool("selection");
    mouse.doubleClickAt(text.x + 50, text.y + 50);
    const editor = document.querySelector(
      ".excalidraw-textEditorContainer > textarea",
    ) as HTMLTextAreaElement;
    expect(editor).not.toBe(null);
    expect(h.state.editingElement?.id).not.toBe(text.id);
    expect(h.elements.length).toBe(2);
    expect(h.state.editingElement?.id).toBe(h.elements[1].id);
  });

  it("locking should include bound text", () => {
    const container = API.createElement({
      type: "rectangle",
      width: 100,
    });
    const textSize = 20;
    const text = API.createElement({
      type: "text",
      text: "ola",
      x: container.width / 2 - textSize / 2,
      y: container.height / 2 - textSize / 2,
      width: textSize,
      height: textSize,
      containerId: container.id,
    });
    mutateElement(container, {
      boundElements: [{ id: text.id, type: "text" }],
    });

    h.elements = [container, text];

    UI.clickTool("selection");
    mouse.clickAt(container.x + 10, container.y + 10);
    Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
      Keyboard.keyPress(KEYS.L);
    });

    expect(h.elements).toEqual([
      expect.objectContaining({
        id: container.id,
        locked: true,
      }),
      expect.objectContaining({
        id: text.id,
        locked: true,
      }),
    ]);
  });

  it("bound text shouldn't be editable via double-click", () => {
    const container = API.createElement({
      type: "rectangle",
      width: 100,
      locked: true,
    });
    const textSize = 20;
    const text = API.createElement({
      type: "text",
      text: "ola",
      x: container.width / 2 - textSize / 2,
      y: container.height / 2 - textSize / 2,
      width: textSize,
      height: textSize,
      containerId: container.id,
      locked: true,
    });
    mutateElement(container, {
      boundElements: [{ id: text.id, type: "text" }],
    });
    h.elements = [container, text];

    UI.clickTool("selection");
    mouse.doubleClickAt(container.width / 2, container.height / 2);

    const editor = document.querySelector(
      ".excalidraw-textEditorContainer > textarea",
    ) as HTMLTextAreaElement;
    expect(editor).not.toBe(null);
    expect(h.state.editingElement?.id).not.toBe(text.id);
    expect(h.elements.length).toBe(3);
    expect(h.state.editingElement?.id).toBe(h.elements[2].id);
  });

  it("bound text shouldn't be editable via text tool", () => {
    const container = API.createElement({
      type: "rectangle",
      width: 100,
      locked: true,
    });
    const textSize = 20;
    const text = API.createElement({
      type: "text",
      text: "ola",
      x: container.width / 2 - textSize / 2,
      y: container.height / 2 - textSize / 2,
      width: textSize,
      height: textSize,
      containerId: container.id,
      locked: true,
    });
    mutateElement(container, {
      boundElements: [{ id: text.id, type: "text" }],
    });
    h.elements = [container, text];

    UI.clickTool("text");
    mouse.clickAt(container.width / 2, container.height / 2);

    const editor = document.querySelector(
      ".excalidraw-textEditorContainer > textarea",
    ) as HTMLTextAreaElement;
    expect(editor).not.toBe(null);
    expect(h.state.editingElement?.id).not.toBe(text.id);
    expect(h.elements.length).toBe(3);
    expect(h.state.editingElement?.id).toBe(h.elements[2].id);
  });
});
