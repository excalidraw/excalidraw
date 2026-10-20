const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadTypeScript } = require("./load-typescript.cjs");

const setup = (copy) => {
  const elements = [{ id: "rectangle", isDeleted: false }];
  const state = { selectedElementIds: { rectangle: true } };
  let deletes = 0;
  const app = {
    state,
    files: {},
    scene: {
      getSelectedElements: () => elements,
      getElementsIncludingDeleted: () => elements,
      getSceneNonce: () => 0,
    },
  };
  const { actionCut } = loadTypeScript(
    "packages/excalidraw/actions/actionClipboard.tsx",
    {
      "@excalidraw/element": {
        CaptureUpdateAction: { EVENTUALLY: "eventually" },
      },
      "@excalidraw/common": {},
      "../clipboard": { copyToClipboard: copy },
      "../components/icons": {},
      "../data/index": {},
      "../i18n": { t: (key) => key },
      "./register": { register: (action) => action },
      "./actionDeleteSelected": {
        actionDeleteSelected: {
          perform: () => {
            deletes++;
            return { elements: [{ ...elements[0], isDeleted: true }] };
          },
        },
      },
    },
  );
  return {
    app,
    elements,
    cut: () => actionCut.perform(elements, state, null, app),
    deletes: () => deletes,
  };
};

test("failed clipboard writes preserve elements and report the error", async () => {
  const s = setup(async () => {
    throw new Error("Clipboard blocked");
  });
  const result = await s.cut();
  assert.equal(s.deletes(), 0);
  assert.equal(result.appState.errorMessage, "Clipboard blocked");
});

test("errors without a message still preserve elements", async () => {
  const s = setup(async () => {
    throw null;
  });
  const result = await s.cut();
  assert.equal(s.deletes(), 0);
  assert.equal(
    result.appState.errorMessage,
    "errors.copyToSystemClipboardFailed",
  );
});

test("cut waits for the clipboard before deleting", async () => {
  let resolve;
  const s = setup(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = s.cut();
  assert.equal(s.deletes(), 0);
  resolve();
  const result = await pending;
  assert.equal(s.deletes(), 1);
  assert.equal(result.elements[0].isDeleted, true);
});

test("a changed selection while copying is not deleted", async () => {
  let resolve;
  const s = setup(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = s.cut();
  s.app.state = { selectedElementIds: { other: true } };
  resolve();
  assert.equal(await pending, false);
  assert.equal(s.deletes(), 0);
});

test("edits made while copying are not overwritten", async () => {
  let resolve;
  const s = setup(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = s.cut();
  s.app.scene.getElementsIncludingDeleted = () => [
    ...s.elements,
    { id: "new" },
  ];
  resolve();
  assert.equal(await pending, false);
  assert.equal(s.deletes(), 0);
});

test("in-place element updates while copying prevent deletion", async () => {
  let resolve;
  const s = setup(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = s.cut();
  s.app.scene.getSceneNonce = () => 1;
  resolve();
  assert.equal(await pending, false);
  assert.equal(s.deletes(), 0);
});
