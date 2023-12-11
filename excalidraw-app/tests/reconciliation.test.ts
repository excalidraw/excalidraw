import { ExcalidrawElement } from "../../src/element/types";
import { randomInteger } from "../../src/random";
import { AppState } from "../../src/types";
import { reconcileElements } from "../collab/reconciliation";

const SEPARATOR = ":";
const NULL_PLACEHOLDER = "x";

type Source = "L" | "R";

type ElementLike = {
  id: string;
  version: number;
  versionNonce: number;
  source: Source;
  fractionalIndex: string | null;
};

const createElementFromString = (stringEl: string): ElementLike => {
  const [_source, id, _version, _versionNonce, _fractionalIndex] =
    stringEl.split(SEPARATOR);

  const source = _source as Source;
  const version =
    _version === NULL_PLACEHOLDER ? randomInteger() : parseInt(_version);
  const versionNonce =
    _versionNonce === NULL_PLACEHOLDER
      ? randomInteger()
      : parseInt(_versionNonce);
  const fractionalIndex =
    _fractionalIndex === NULL_PLACEHOLDER ? null : _fractionalIndex;

  return {
    id,
    version,
    versionNonce,
    source,
    fractionalIndex,
  };
};

const testReconciled = (reconciled: ElementLike[], expected: ElementLike[]) => {
  expect(reconciled.length).toBe(expected.length);

  for (let i = 0; i < expected.length; i++) {
    expect(reconciled[i].id).toBe(expected[i].id);
    expect(reconciled[i].source).toBe(expected[i].source);
    expect(reconciled[i].version).toBe(expected[i].version);
  }
};

const getReconciledAndExpectedElements = (
  local_input: string[],
  remote_input: string[],
  expected_input: string[],
  appState?: AppState,
) => {
  const localEls = local_input.map((ls) =>
    createElementFromString(ls),
  ) as any as ExcalidrawElement[];
  const remoteEls = remote_input.map((rs) =>
    createElementFromString(rs),
  ) as any as ExcalidrawElement[];

  const expectedEls = expected_input.map((es) => createElementFromString(es));

  const reconciledEls = reconcileElements(
    localEls,
    remoteEls,
    appState ?? ({} as AppState),
  ) as any as ElementLike[];

  return [reconciledEls, expectedEls];
};

describe("reconcile without fractional indices", () => {
  it("take higher version - remote", () => {
    const [reconciledEls, expectedEls] = getReconciledAndExpectedElements(
      ["L:1:2:x:x", "L:2:1:x:x"],
      ["R:1:3:x:x"],
      ["R:1:3:x:x", "L:2:1:x:x"],
    );

    testReconciled(reconciledEls, expectedEls);
  });

  it("take higher version - local", () => {
    const [reconciledEls, expectedEls] = getReconciledAndExpectedElements(
      ["L:1:2:x:x", "L:2:2:x:x"],
      ["R:1:3:x:x"],
      ["R:1:3:x:x", "L:2:2:x:x"],
    );
    testReconciled(reconciledEls, expectedEls);
  });

  it("take higher version - mix few", () => {
    const [reconciledEls, expectedEls] = getReconciledAndExpectedElements(
      ["L:1:2:x:x", "L:2:3:x:x"],
      ["R:1:3:x:x", "R:2:2:x:x"],
      ["R:1:3:x:x", "L:2:3:x:x"],
    );

    testReconciled(reconciledEls, expectedEls);
  });

  it("take higher version - mix more", () => {
    const [reconciledEls, expectedEls] = getReconciledAndExpectedElements(
      ["L:1:2:x:x", "L:2:3:x:x", "L:3:10:x:x"],
      ["R:1:3:x:x", "R:2:2:x:x"],
      ["R:1:3:x:x", "L:2:3:x:x", "L:3:10:x:x"],
    );

    testReconciled(reconciledEls, expectedEls);
  });

  it("take lower versionNonce", () => {
    const length = Math.floor(Math.random() * 100);

    const randomLocalVersionNonce: number[] = [];
    const randomRemoteVersionNonce: number[] = [];

    for (let i = 0; i < length; i++) {
      randomLocalVersionNonce.push(randomInteger());
      randomRemoteVersionNonce.push(randomInteger());
    }

    const local_input: string[] = [];
    const remote_input: string[] = [];
    const expected_input: string[] = [];

    for (let i = 0; i < length; i++) {
      local_input.push(`L:${i}:1:${randomLocalVersionNonce[i]}:x`);
      remote_input.push(`R:${i}:1:${randomRemoteVersionNonce[i]}:x`);
      const localOrRemote =
        randomLocalVersionNonce[i] < randomRemoteVersionNonce[i];
      expected_input.push(
        `${localOrRemote ? "L" : "R"}:${i}:1:${
          localOrRemote
            ? randomLocalVersionNonce[i]
            : randomRemoteVersionNonce[i]
        }:x`,
      );
    }

    const [reconciledEls, expectedEls] = getReconciledAndExpectedElements(
      local_input,
      remote_input,
      expected_input,
    );

    testReconciled(reconciledEls, expectedEls);
  });

  it("identical elements", () => {
    const [reconciledEls, expectedEls] = getReconciledAndExpectedElements(
      ["L:1:1:1:x", "L:2:2:2:x"],
      ["R:1:1:1:x", "R:2:2:2:x"],
      ["R:1:1:1:x", "R:2:2:2:x"],
    );

    testReconciled(reconciledEls, expectedEls);
  });

  it("identical elements, different order", () => {
    const [reconciledEls, expectedEls] = getReconciledAndExpectedElements(
      ["L:1:1:1:x", "L:2:2:2:x"],
      ["R:2:2:2:x", "R:1:1:1:x"],
      ["R:2:2:2:x", "R:1:1:1:x"],
    );
    testReconciled(reconciledEls, expectedEls);
  });
});
