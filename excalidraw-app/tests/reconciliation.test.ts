import { ExcalidrawElement } from "../../packages/excalidraw/element/types";
import {
  orderByFractionalIndex,
  validateFractionalIndices,
} from "../../packages/excalidraw/fractionalIndex";
import { randomInteger } from "../../packages/excalidraw/random";
import { AppState } from "../../packages/excalidraw/types";
import { reconcileElements } from "../collab/reconciliation";
import { InvalidFractionalIndexError } from "../../packages/excalidraw/errors";
// import { generateJitteredKeyBetween } from "fractional-indexing";

const SEPARATOR = ":";
const NULL_PLACEHOLDER = "x";

type Source = "L" | "R";

type ElementLike = {
  id: string;
  version: number;
  versionNonce: number;
  source: Source;
  index: string | null;
};

const createElementFromString = (stringEl: string): ElementLike => {
  const [_source, id, _version, _versionNonce, _index] =
    stringEl.split(SEPARATOR);

  const source = _source as Source;
  const version =
    _version === NULL_PLACEHOLDER ? randomInteger() : parseInt(_version);
  const versionNonce =
    _versionNonce === NULL_PLACEHOLDER
      ? randomInteger()
      : parseInt(_versionNonce);
  const index = _index === NULL_PLACEHOLDER ? null : _index;

  return {
    id,
    version,
    versionNonce,
    source,
    index,
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
  local: string[],
  remote: string[],
  expected: string[],
  appState?: AppState,
) => {
  const localEls = local.map((ls) =>
    createElementFromString(ls),
  ) as any as ExcalidrawElement[];
  const remoteEls = remote.map((rs) =>
    createElementFromString(rs),
  ) as any as ExcalidrawElement[];

  const expectedEls = expected.map((es) => createElementFromString(es));

  const reconciledEls = reconcileElements(
    localEls,
    remoteEls,
    appState ?? ({} as AppState),
  ) as any as ElementLike[];

  return [reconciledEls, expectedEls];
};

// TODO_FI: these tests are not really readable
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

describe("reconcile with fractional indices", () => {
  it("order by fractional indices", () => {
    const first = generateKeyBetween(null, null);
    const second = generateKeyBetween(first, null);
    const third = generateKeyBetween(second, null);

    const [reconciledEls, expectedEls] = getReconciledAndExpectedElements(
      [`L:1:1:1:${first}`, `L:2:1:1:${second}`],
      // simulates a z-index change for (el.id = 1)
      [`R:1:2:x:${third}`],
      [`L:2:1:1${second}`, `R:1:2:x:${third}`],
    );

    testReconciled(reconciledEls, expectedEls);
  });

  it("order by fractional indices - longer", () => {
    const totalCount = Math.floor(Math.random() * 100 + 10);
    let nextKey = generateKeyBetween(null, null);

    const local_input: string[] = [];
    const remote_input: string[] = [];
    const expected_input: string[] = [];

    for (let i = 0; i < totalCount; i++) {
      nextKey = generateKeyBetween(nextKey, null);
      const localStr = `L:${i}:1:x:${nextKey}`;
      local_input.push(localStr);
      if (Math.random() > 0.5) {
        const remoteStr = `R:${i}:2:x:${generateJitteredKeyBetween(
          nextKey,
          null,
          base36CharSet,
        )}`;
        remote_input.push(remoteStr);
        expected_input.push(remoteStr);
      } else {
        expected_input.push(localStr);
      }
    }

    const [reconciledEls, expectedEls] = getReconciledAndExpectedElements(
      local_input,
      remote_input,
      expected_input,
    );

    testReconciled(
      reconciledEls,
      orderByFractionalIndex(
        expectedEls as any as ExcalidrawElement[],
      ) as any as ElementLike[],
    );
    expect(() =>
      validateFractionalIndices(reconciledEls as any as ExcalidrawElement[]),
    ).not.toThrowError(InvalidFractionalIndexError);

    const localEls = local_input.map((ls) =>
      createElementFromString(ls),
    ) as any as ExcalidrawElement[];

    const localFractionalIndices = new Set(localEls.map((e) => e.index));
    const reconciledFractionalIndices = new Set(
      reconciledEls.map((e) => e.index),
    );

    let actualDiffCount = 0;
    for (const fi of localFractionalIndices) {
      if (!reconciledFractionalIndices.has(fi)) {
        actualDiffCount += 1;
      }
    }

    expect(actualDiffCount).toBe(remote_input.length);
  });

  it("should throw on duplicate indices as we don't update indices in reconciliation", () => {
    const first = generateKeyBetween(null, null);
    const second = generateKeyBetween(first, null);
    const third = generateKeyBetween(second, null);

    const [reconciledEls, expectedEls] = getReconciledAndExpectedElements(
      [`L:1:1:1:${first}`, `L:2:1:1:${second}`, `L:3:1:1:${third}`],
      // simulates a z-index change for (el.id = 1)
      [`R:1:2:x:${third}`],
      // order by id since R:1 and L:3 have the same fractional index and
      // id 1 comes before id 3
      [`L:2:1:1${second}`, `R:1:2:x:x`, `L:3:1:1:x`],
    );

    testReconciled(reconciledEls, expectedEls);

    // // we do not restore in reconciliation
    // // elements are instead restored in updateScene
    expect(() =>
      validateFractionalIndices(reconciledEls as any as ExcalidrawElement[]),
    ).toThrowError(InvalidFractionalIndexError);
  });
});
