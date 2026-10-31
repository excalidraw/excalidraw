import { KEYS, reseed } from "@excalidraw/common";

import { Excalidraw } from "@excalidraw/excalidraw";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { UI, Keyboard, Pointer } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  render,
  unmountComponent,
} from "@excalidraw/excalidraw/tests/test-utils";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");

beforeEach(async () => {
  localStorage.clear();
  reseed(7);
  mouse.reset();

  await render(<Excalidraw handleKeyboardGlobally={true} />);
  h.state.width = 1000;
  h.state.height = 1000;

  // The bounds of hand-drawn linear elements may change after flipping, so
  // removing this style for testing
  UI.clickTool("arrow");
  UI.clickByTitle("Architect");
  UI.clickTool("selection");
});

describe("flow chart creation", () => {
  beforeEach(() => {
    API.clearSelection();
    const rectangle = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });

    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);
  });

  // multiple at once
  it("create multiple successor nodes at once", () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });

    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.length).toBe(5);
    expect(h.elements.filter((el) => el.type === "rectangle").length).toBe(3);
    expect(h.elements.filter((el) => el.type === "arrow").length).toBe(2);
  });

  it("when directions are changed, only the last same directions will apply", () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);

      Keyboard.keyPress(KEYS.ARROW_LEFT);

      Keyboard.keyPress(KEYS.ARROW_UP);
      Keyboard.keyPress(KEYS.ARROW_UP);
      Keyboard.keyPress(KEYS.ARROW_UP);
    });

    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.length).toBe(7);
    expect(h.elements.filter((el) => el.type === "rectangle").length).toBe(4);
    expect(h.elements.filter((el) => el.type === "arrow").length).toBe(3);
  });

  it("when escaped, no nodes will be created", () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_UP);
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });

    Keyboard.keyPress(KEYS.ESCAPE);
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.length).toBe(1);
  });

  it("create nodes one at a time", () => {
    const initialNode = h.elements[0];

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.length).toBe(3);
    expect(h.elements.filter((el) => el.type === "rectangle").length).toBe(2);
    expect(h.elements.filter((el) => el.type === "arrow").length).toBe(1);

    const firstChildNode = h.elements.filter(
      (el) => el.type === "rectangle" && el.id !== initialNode.id,
    )[0];
    expect(firstChildNode).not.toBe(null);
    expect(firstChildNode.id).toBe(Object.keys(h.state.selectedElementIds)[0]);

    API.setSelectedElements([initialNode] as NonDeletedExcalidrawElement[]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.length).toBe(5);
    expect(h.elements.filter((el) => el.type === "rectangle").length).toBe(3);
    expect(h.elements.filter((el) => el.type === "arrow").length).toBe(2);

    const secondChildNode = h.elements.filter(
      (el) =>
        el.type === "rectangle" &&
        el.id !== initialNode.id &&
        el.id !== firstChildNode.id,
    )[0];
    expect(secondChildNode).not.toBe(null);
    expect(secondChildNode.id).toBe(Object.keys(h.state.selectedElementIds)[0]);

    API.setSelectedElements([initialNode] as NonDeletedExcalidrawElement[]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.length).toBe(7);
    expect(h.elements.filter((el) => el.type === "rectangle").length).toBe(4);
    expect(h.elements.filter((el) => el.type === "arrow").length).toBe(3);

    const thirdChildNode = h.elements.filter(
      (el) =>
        el.type === "rectangle" &&
        el.id !== initialNode.id &&
        el.id !== firstChildNode.id &&
        el.id !== secondChildNode.id,
    )[0];

    expect(thirdChildNode).not.toBe(null);
    expect(thirdChildNode.id).toBe(Object.keys(h.state.selectedElementIds)[0]);

    expect(firstChildNode.x).toBe(secondChildNode.x);
    expect(secondChildNode.x).toBe(thirdChildNode.x);
  });

  // regression for #8518: additional siblings must not overlap existing ones
  it("does not overlap existing siblings when adding more children (down)", () => {
    API.clearSelection();
    const parent = API.createElement({
      type: "rectangle",
      width: 400,
      height: 300,
    });
    API.setElements([parent]);
    API.setSelectedElements([parent]);

    for (let i = 0; i < 4; i++) {
      API.setSelectedElements([parent]);
      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(KEYS.ARROW_DOWN);
      });
      Keyboard.keyUp(KEYS.CTRL_OR_CMD);
    }

    const children = h.elements.filter(
      (el) => el.type === "rectangle" && el.id !== parent.id,
    );
    expect(children.length).toBe(4);

    // all siblings should sit on the same row (no vertical misalignment)
    const ys = new Set(children.map((c) => c.y));
    expect(ys.size).toBe(1);

    // no two siblings should overlap horizontally
    const sorted = [...children].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].x).toBeGreaterThanOrEqual(
        sorted[i - 1].x + sorted[i - 1].width,
      );
    }
  });

  // regression for #8518: a second batch of children (added by holding the
  // modifier and pressing the arrow several times) must clear the first batch
  it("does not overlap a previous batch of children (down)", () => {
    API.clearSelection();
    const parent = API.createElement({
      type: "rectangle",
      width: 400,
      height: 300,
    });
    API.setElements([parent]);

    // hold the modifier and press down N times to create a batch at once
    const addBatch = (count: number) => {
      API.setSelectedElements([parent]);
      Keyboard.withModifierKeys({ ctrl: true }, () => {
        for (let i = 0; i < count; i++) {
          Keyboard.keyPress(KEYS.ARROW_DOWN);
        }
      });
      Keyboard.keyUp(KEYS.CTRL_OR_CMD);
    };

    addBatch(3);
    addBatch(2);

    const children = h.elements.filter(
      (el) => el.type === "rectangle" && el.id !== parent.id,
    );
    expect(children.length).toBe(5);

    const overlaps = (a: typeof children[0], b: typeof children[0]) =>
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y;

    for (let i = 0; i < children.length; i++) {
      for (let j = i + 1; j < children.length; j++) {
        expect(overlaps(children[i], children[j])).toBe(false);
      }
    }
  });

  // regression for #8518: a new child must also clear nodes that aren't the
  // start node's direct siblings but sit where it would land — e.g. a sibling
  // reached through a shared parent
  it("does not overlap a sibling reached through a shared parent", () => {
    API.clearSelection();
    const parent = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });
    API.setElements([parent]);

    // two right-children stack into a column to the right of the parent
    API.setSelectedElements([parent]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    const rightChildren = h.elements
      .filter((el) => el.type === "rectangle" && el.id !== parent.id)
      .sort((a, b) => a.y - b.y);
    expect(rightChildren.length).toBe(2);
    const [upper, lower] = rightChildren;

    // add a child below the upper sibling; it must not land on the lower one
    // that sits directly beneath it
    API.setSelectedElements([upper] as NonDeletedExcalidrawElement[]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_DOWN);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    const newChild = h.elements.filter(
      (el) =>
        el.type === "rectangle" &&
        el.id !== parent.id &&
        el.id !== upper.id &&
        el.id !== lower.id,
    )[0];
    expect(newChild).toBeTruthy();

    const overlaps = (a: typeof newChild, b: typeof lower) =>
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y;

    expect(overlaps(newChild, lower)).toBe(false);
  });
});

describe("flow chart band-search placement", () => {
  const addChild = (parent: NonDeletedExcalidrawElement, key: string) => {
    API.setSelectedElements([parent]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(key);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);
  };

  const children = (parent: NonDeletedExcalidrawElement) =>
    h.elements.filter((el) => el.type === "rectangle" && el.id !== parent.id);

  const pendingRects = () =>
    (h.app.flowchart.pendingNodes ?? [])
      .filter((el) => el.type === "rectangle")
      .map((el) => ({ x: el.x, y: el.y }));

  it("places the first child exactly one offset away in every direction", () => {
    const cases = [
      { key: KEYS.ARROW_RIGHT, x: 300, y: 0 },
      { key: KEYS.ARROW_LEFT, x: -300, y: 0 },
      { key: KEYS.ARROW_DOWN, x: 0, y: 200 },
      { key: KEYS.ARROW_UP, x: 0, y: -200 },
    ];

    for (const { key, x, y } of cases) {
      API.clearSelection();
      const parent = API.createElement({
        type: "rectangle",
        width: 200,
        height: 100,
      });
      API.setElements([parent]);

      addChild(parent, key);

      const [child] = children(parent);
      expect(child).toBeTruthy();
      expect(child.x).toBe(x);
      expect(child.y).toBe(y);
    }
  });

  it("slides into the nearest free gap between obstacles without moving them", () => {
    API.clearSelection();
    const parent = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });
    API.setElements([parent]);

    addChild(parent, KEYS.ARROW_DOWN);
    addChild(parent, KEYS.ARROW_DOWN);

    const [c1, c2] = children(parent).sort((a, b) => a.x - b.x);
    expect([c1.x, c2.x]).toEqual([0, 300]);

    // widen the gap between the siblings so a third child fits in between
    API.updateElement(c2, { x: 600 });

    addChild(parent, KEYS.ARROW_DOWN);

    const c3 = children(parent).find(
      (el) => el.id !== c1.id && el.id !== c2.id,
    )!;
    expect({ x: c3.x, y: c3.y }).toEqual({ x: 300, y: 200 });

    // the obstacles were not moved
    expect({ x: c1.x, y: c1.y }).toEqual({ x: 0, y: 200 });
    expect({ x: c2.x, y: c2.y }).toEqual({ x: 600, y: 200 });
  });

  it("centers the pending cluster on the parent while it grows", () => {
    API.clearSelection();
    const parent = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });
    API.setElements([parent]);
    API.setSelectedElements([parent]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      expect(pendingRects()).toEqual([{ x: 300, y: 0 }]);

      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      expect(pendingRects()).toEqual([
        { x: 300, y: -100 },
        { x: 300, y: 100 },
      ]);

      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      expect(pendingRects()).toEqual([
        { x: 300, y: -200 },
        { x: 300, y: 0 },
        { x: 300, y: 200 },
      ]);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);
  });

  it("keeps pending nodes in place while an obstacle blocks the centered slot", () => {
    API.clearSelection();
    const parent = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });
    API.setElements([parent]);

    // an obstacle above the band leaves room for the first node only
    addChild(parent, KEYS.ARROW_RIGHT);
    const [c1] = children(parent);
    API.updateElement(c1, { y: -250 });

    API.setSelectedElements([parent]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      expect(pendingRects()).toEqual([{ x: 300, y: 0 }]);

      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      expect(pendingRects()).toEqual([
        { x: 300, y: 0 },
        { x: 300, y: 200 },
      ]);

      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      expect(pendingRects()).toEqual([
        { x: 300, y: 0 },
        { x: 300, y: 200 },
        { x: 300, y: 400 },
      ]);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);
  });

  it("keeps a gap from nodes between the parent's row and the band", () => {
    API.clearSelection();
    const parent = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });
    API.setElements([parent]);
    API.setSelectedElements([parent]);

    // the centered right children: the lower one ends exactly where the
    // band below the parent begins (y: 100..200)
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    API.setSelectedElements([parent]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_DOWN);
      Keyboard.keyPress(KEYS.ARROW_DOWN);
      // the centered slot (x: -150..350) would sit flush under the lower
      // right child (x: 300..500)
      expect(pendingRects()).toEqual([
        { x: -300, y: 200 },
        { x: 0, y: 200 },
      ]);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);
  });

  it.each([
    { key: KEYS.ARROW_UP, y: -0.1, height: 100 },
    { key: KEYS.ARROW_DOWN, y: 0.1, height: 100.3 },
  ])(
    "keeps children centered beside a node in the parent's row ($key, y=$y)",
    ({ key, y, height }) => {
      API.clearSelection();
      const parent = API.createElement({
        type: "rectangle",
        y,
        width: 200,
        height,
      });
      API.setElements([parent]);

      // Centering the right child can round its top or bottom edge slightly
      // past the parent's, even though both nodes occupy the same row.
      addChild(parent, KEYS.ARROW_RIGHT);

      API.setSelectedElements([parent]);
      Keyboard.withModifierKeys({ ctrl: true }, () => {
        Keyboard.keyPress(key);
        Keyboard.keyPress(key);
        expect(pendingRects().map(({ x }) => x)).toEqual([-150, 150]);
      });
      Keyboard.keyUp(KEYS.CTRL_OR_CMD);
    },
  );

  it("repositions the whole pending cluster when it no longer fits", () => {
    API.clearSelection();
    const parent = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });
    API.setElements([parent]);

    // box in the space right of the parent, leaving room for a single node
    addChild(parent, KEYS.ARROW_RIGHT);
    const [c1] = children(parent);
    API.updateElement(c1, { y: -300 });

    addChild(parent, KEYS.ARROW_RIGHT);
    const c2 = children(parent).find((el) => el.id !== c1.id)!;
    expect({ x: c2.x, y: c2.y }).toEqual({ x: 300, y: 0 });
    API.updateElement(c2, { y: 300 });

    API.setSelectedElements([parent]);
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      expect(pendingRects()).toEqual([{ x: 300, y: 0 }]);

      // growing cannot extend at either end, so the cluster moves as a whole
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      expect(pendingRects()).toEqual([
        { x: 300, y: -100 },
        { x: 300, y: 100 },
      ]);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    // the obstacles were not moved
    expect({ x: c1.x, y: c1.y }).toEqual({ x: 300, y: -300 });
    expect({ x: c2.x, y: c2.y }).toEqual({ x: 300, y: 300 });
  });
});

describe("flow chart navigation", () => {
  it("single node at each level", () => {
    /**
     * ▨ -> ▨ -> ▨ -> ▨ -> ▨
     */

    API.clearSelection();
    const rectangle = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });

    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    expect(h.elements.filter((el) => el.type === "rectangle").length).toBe(5);
    expect(h.elements.filter((el) => el.type === "arrow").length).toBe(4);

    // all the way to the left, gets us to the first node
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
      Keyboard.keyPress(KEYS.ARROW_LEFT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rectangle.id]).toBe(true);

    // all the way to the right, gets us to the last node
    const rightMostNode = h.elements[h.elements.length - 2];
    expect(rightMostNode);
    expect(rightMostNode.type).toBe("rectangle");
    Keyboard.withModifierKeys({ alt: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.ALT);
    expect(h.state.selectedElementIds[rightMostNode.id]).toBe(true);
  });

  const createNode = (key: string) => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(key);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);
    return h.app.scene
      .getNonDeletedElements()
      .find((el) => h.state.selectedElementIds[el.id])!;
  };

  const navigate = (...keys: string[]) => {
    Keyboard.withModifierKeys({ alt: true }, () => {
      keys.forEach((key) => Keyboard.keyPress(key));
    });
    Keyboard.keyUp(KEYS.ALT);
  };

  const expectSelected = (element: ExcalidrawElement) => {
    expect(Object.keys(h.state.selectedElementIds)).toEqual([element.id]);
  };

  const node = (x: number, y: number, width = 200, height = 80) =>
    API.createElement({ type: "rectangle", x, y, width, height });

  const link = (
    from: ExcalidrawElement,
    to: ExcalidrawElement,
    elbowed = true,
  ) =>
    API.createElement({
      type: "arrow",
      elbowed,
      startBinding: {
        elementId: from.id,
        fixedPoint: [0.5, 0.5],
        mode: "orbit",
      },
      endBinding: { elementId: to.id, fixedPoint: [0.5, 0.5], mode: "orbit" },
    });

  it("moves to the node that's visually in that direction", () => {
    /**
     * A → B → C
     *         ↓
     *         D
     *         ↓
     *     F ← E
     */
    const a = API.createElement({ type: "rectangle", width: 200, height: 100 });
    API.setElements([a]);
    API.setSelectedElements([a]);

    const b = createNode(KEYS.ARROW_RIGHT);
    createNode(KEYS.ARROW_RIGHT);
    const d = createNode(KEYS.ARROW_DOWN);
    const e = createNode(KEYS.ARROW_DOWN);
    const f = createNode(KEYS.ARROW_LEFT);

    // straight up, not along the arrow back to E
    navigate(KEYS.ARROW_UP);
    expectSelected(b);

    // nothing to the right of E
    API.setSelectedElements([e]);
    navigate(KEYS.ARROW_RIGHT);
    expectSelected(e);

    // F is the only node more below A than beside it
    API.setSelectedElements([a]);
    navigate(KEYS.ARROW_DOWN);
    expectSelected(f);

    // B and F are equally far: the upper one wins
    API.setSelectedElements([d]);
    navigate(KEYS.ARROW_LEFT);
    expectSelected(b);

    // A sits between the rows, overlapping D's row by a sliver: that doesn't
    // put D in line with it, so the much nearer B wins
    API.updateElement(a, { y: a.y + 100.2 });
    API.setSelectedElements([a]);
    navigate(KEYS.ARROW_RIGHT);
    expectSelected(b);
  });

  it("breaks ties by links, alignment and reading order", () => {
    /**
     * X ←┐
     *    B
     * A ─┤
     *    C
     * Y ←┘
     */
    // at a fractional y, B and C are equally level with A only up to float
    // noise, which mustn't decide between them
    const a = API.createElement({
      type: "rectangle",
      y: 0.7,
      width: 200,
      height: 100,
    });
    API.setElements([a]);
    API.setSelectedElements([a]);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);
    const [b, c] = h.app.scene
      .getNonDeletedElements()
      .filter((el) => el.type === "rectangle" && el.id !== a.id)
      .sort((el1, el2) => el1.y - el2.y);

    API.setSelectedElements([b]);
    const x = createNode(KEYS.ARROW_LEFT);
    API.setSelectedElements([c]);
    const y = createNode(KEYS.ARROW_LEFT);
    API.updateElement(y, { y: y.y + 10 });

    // siblings aren't linked, but C is right below B
    API.setSelectedElements([b]);
    navigate(KEYS.ARROW_DOWN);
    expectSelected(c);

    // A and Y are about equally far: C links to Y
    navigate(KEYS.ARROW_LEFT);
    expectSelected(y);

    // B and C are equally far, both linked and equally level: the upper one
    // wins
    API.setSelectedElements([a]);
    navigate(KEYS.ARROW_RIGHT);
    expectSelected(b);

    // A and X are equally far: B links to X, even right after coming from A
    API.setSelectedElements([a]);
    navigate(KEYS.ARROW_RIGHT, KEYS.ARROW_LEFT);
    expectSelected(x);

    // P and Q are both in line with N, equally far and linked from it: P is
    // level with N's center, Q is higher
    const n = node(0, 0, 200, 200);
    const q = node(300, -30);
    const p = node(300, 60);
    API.setElements([n, q, p, link(n, q), link(n, p)]);
    API.setSelectedElements([n]);
    navigate(KEYS.ARROW_RIGHT);
    expectSelected(p);

    // links still come first
    API.setElements([n, q, p, link(n, q)]);
    API.setSelectedElements([n]);
    navigate(KEYS.ARROW_RIGHT);
    expectSelected(q);
  });

  it("prefers nodes in line, then linked, then in the cone, then any ahead", () => {
    // to the left of S, A shares its row while B is linked to S but lower
    let s = node(450, 170);
    let a = node(0, 170);
    let b = node(150, 530);
    const c = node(750, 170);
    API.setElements([s, a, b, c, link(s, c), link(c, a), link(s, b)]);
    API.setSelectedElements([s]);
    navigate(KEYS.ARROW_LEFT);
    expectSelected(a);

    // nothing shares S's row: A, linked to S, lies past S's right edge (if
    // mostly above it) and wins over B, which is more to the right but isn't
    // linked (through plain arrows, which link nodes just like elbow ones)
    const d = node(300, 80);
    a = node(300, 260);
    b = node(580, 520);
    s = node(0, 620);
    API.setElements([
      d,
      a,
      b,
      s,
      link(d, a, false),
      link(d, b, false),
      link(a, s, false),
    ]);
    API.setSelectedElements([s]);
    navigate(KEYS.ARROW_RIGHT);
    expectSelected(a);

    // below S, A is in the cone while the nearer B is more beside S than
    // below it
    const e = node(0, -300);
    s = node(0, 0);
    a = node(150, 400);
    b = node(400, 150);
    API.setElements([e, s, a, b, link(e, s), link(e, a), link(e, b)]);
    API.setSelectedElements([s]);
    navigate(KEYS.ARROW_DOWN);
    expectSelected(a);

    // A's center is more to the right of S's than below it, so A is in the
    // cone and beats the farther F, though A's nearest corner is more below
    // S than beside it (while below S, the linked B wins)
    s = node(300, 270);
    a = node(580, 470);
    b = node(0, 630);
    const f = node(900, 400);
    API.setElements([
      d,
      s,
      a,
      b,
      f,
      link(d, s),
      link(d, a),
      link(s, b),
      link(d, f),
    ]);
    API.setSelectedElements([s]);
    navigate(KEYS.ARROW_RIGHT);
    expectSelected(a);
    API.setSelectedElements([s]);
    navigate(KEYS.ARROW_DOWN);
    expectSelected(b);
  });
});
