import { expect } from "chai";
import {
  ExcalidrawElement,
  OrderedExcalidrawElement,
} from "../../packages/excalidraw/element/types";
import {
  ReconciledElements,
  reconcileElements,
} from "../../excalidraw-app/collab/reconciliation";
import { randomInteger } from "../../packages/excalidraw/random";
import { AppState } from "../../packages/excalidraw/types";
import { cloneJSON } from "../../packages/excalidraw/utils";
import { syncFractionalIndices } from "../../packages/excalidraw/fractionalIndex";

type Id = string;
type ElementLike = {
  id: string;
  version: number;
  versionNonce: number;
  index: string;
};

type Cache = Record<string, ExcalidrawElement | undefined>;

const createElement = (opts: { uid: string } | ElementLike) => {
  let uid: string;
  let id: string;
  let version: number | null;
  let versionNonce: number | null = null;
  if ("uid" in opts) {
    const match = opts.uid.match(/^(\w+)(?::(\d+))?(?:\((\w+)\))?$/)!;
    id = match[1];
    version = match[2] ? parseInt(match[2]) : null;
    uid = version ? `${id}:${version}` : id;
  } else {
    ({ id, version, versionNonce } = opts);
    uid = id;
  }
  return {
    uid,
    id,
    version,
    versionNonce: versionNonce || randomInteger(),
  };
};

const idsToElements = (
  ids: (Id | ElementLike)[],
  cache: Cache = {},
): OrderedExcalidrawElement[] => {
  return syncFractionalIndices(
    ids.reduce((acc, _uid) => {
      const { uid, id, version, versionNonce } = createElement(
        typeof _uid === "string" ? { uid: _uid } : _uid,
      );
      const cached = cache[uid];
      const elem = {
        id,
        version: version ?? 0,
        versionNonce,
        ...cached,
      } as OrderedExcalidrawElement;
      // @ts-ignore
      cache[uid] = elem;
      acc.push(elem);
      return acc;
    }, [] as OrderedExcalidrawElement[]),
  );
};

const test = <U extends `${string}:${"L" | "R"}`>(
  local: (Id | ElementLike)[],
  remote: (Id | ElementLike)[],
  target: U[],
  bidirectional = true,
) => {
  const cache: Cache = {};
  const _local = idsToElements(local, cache);
  const _remote = idsToElements(remote, cache);
  // console.log(
  //   _local.map((x) => `${x.id}, ${x.index}`),
  //   _remote.map((x) => `${x.id}, ${x.index}`),
  // );

  const _target = target.map((uid) => {
    const [, id, source] = uid.match(/^(\w+):([LR])$/)!;
    return (source === "L" ? _local : _remote).find((e) => e.id === id)!;
  }) as any as ReconciledElements;
  const remoteReconciled = reconcileElements(_local, _remote, {} as AppState);
  // console.log(remoteReconciled.map((x) => `${x.id}, ${x.index}`));

  expect(target.length).equal(remoteReconciled.length);
  expect(remoteReconciled).deep.equal(_target, "remote reconciliation");

  const __local = cloneJSON(_remote);
  const __remote = cloneJSON(remoteReconciled);
  if (bidirectional) {
    try {
      expect(
        reconcileElements(
          cloneJSON(__local),
          cloneJSON(__remote as unknown as OrderedExcalidrawElement[]),
          {} as AppState,
        ),
      ).deep.equal(remoteReconciled, "local re-reconciliation");
    } catch (error: any) {
      console.error("local original", __local);
      console.error("remote reconciled", __remote);
      throw error;
    }
  }
};

// -----------------------------------------------------------------------------

// TODO_FI: test the potential concurrency issues (always converging to the same result - though it should already be tested?)
// TODO_FI: think about extending the test cases to cover fractional indices issues (also compared to previous intentions)
describe("elements reconciliation", () => {
  it("reconcileElements()", () => {
    // -------------------------------------------------------------------------
    //
    // in following tests, we pass:
    //  (1) an array of local elements and their version (:1, :2...)
    //  (2) an array of remote elements and their version (:1, :2...)
    //  (3) expected reconciled elements
    //
    // in the reconciled array:
    //  :L means local element was resolved
    //  :R means remote element was resolved
    //
    // if a remote element is prefixed with parentheses, the enclosed string:
    //  (^) means the element is the first element in the array
    //  (<id>) means the element is preceded by <id> element
    //
    // if versions are missing, it defaults to version 0
    // -------------------------------------------------------------------------

    test(["A:1", "B:1", "C:1"], ["B:2"], ["A:L", "B:R", "C:L"]);
    test(["A:1", "B:1", "C"], ["B:2", "A:2"], ["B:R", "A:R", "C:L"]);
    test(["A:2", "B:1", "C"], ["B:2", "A:1"], ["A:L", "B:R", "C:L"]);
    test(["A:1", "C:1"], ["B:1"], ["A:L", "B:R", "C:L"]);
    test(["A", "B"], ["A:1"], ["A:R", "B:L"]);
    test(["A"], ["A", "B"], ["A:L", "B:R"]);
    test(["A"], ["A:1", "B"], ["A:R", "B:R"]);
    test(["A:2"], ["A:1", "B"], ["A:L", "B:R"]);
    test(["A:2"], ["B", "A:1"], ["A:L", "B:R"]);
    test(["A:1"], ["B", "A:2"], ["B:R", "A:R"]);
    test(["A"], ["A:1"], ["A:R"]);
    test(["A", "B:1", "D"], ["B", "C:2", "A"], ["C:R", "A:R", "B:L", "D:L"]);

    // some of the following tests are kinda arbitrary and they're less
    // likely to happen in real-world cases
    test(["A", "B"], ["B:1", "A:1"], ["B:R", "A:R"]);
    test(["A:2", "B:2"], ["B:1", "A:1"], ["A:L", "B:L"]);
    test(["A", "B", "C"], ["A", "B:2", "G", "C"], ["A:L", "B:R", "G:R", "C:L"]);
    test(["A", "B", "C"], ["A", "B:2", "G"], ["A:R", "B:R", "C:L", "G:R"]);

    test(
      ["A:2", "B:2", "C"],
      ["D", "B:1", "A:3"],
      ["D:R", "B:L", "A:R", "C:L"],
    );
    test(
      ["A:2", "B:2", "C"],
      ["D", "B:2", "A:3", "C"],
      ["D:R", "B:L", "A:R", "C:L"],
    );
    test(
      ["A", "B", "C", "D", "E", "F"],
      ["A", "B:2", "X", "E:2", "F", "Y"],
      ["A:L", "B:R", "X:R", "C:L", "E:R", "D:L", "F:L", "Y:R"],
    );

    test(
      ["A", "B", "C"],
      ["X", "Y", "Z"],
      ["A:L", "X:R", "B:L", "Y:R", "C:L", "Z:R"],
    );

    test(["A"], ["X", "Y"], ["A:L", "X:R", "Y:R"]);
    test(["A"], ["X", "Y", "Z"], ["A:L", "X:R", "Y:R", "Z:R"]);
    test(["A", "B"], ["C", "D", "F"], ["A:L", "C:R", "B:L", "D:R", "F:R"]);

    test(
      ["A", "B", "C", "D"],
      ["C:1", "B", "D:1"],
      ["A:L", "C:R", "B:L", "D:R"],
    );
    test(
      ["B", "A", "C"],
      ["X", "Y", "Z"],
      ["B:L", "X:R", "A:L", "Y:R", "C:L", "Z:R"],
    );
    test(
      ["A", "B", "C", "D", "E"],
      ["X", "Y", "Z"],
      ["A:L", "X:R", "B:L", "Y:R", "C:L", "Z:R", "D:L", "E:L"],
    );
    test(
      ["A", "B", "C", "X", "D", "Y", "Z"],
      ["A", "X", "Y", "Z"],
      ["A:R", "B:L", "C:L", "X:R", "D:L", "Y:R", "Z:R"],
    );
    test(
      ["A", "B", "C", "D", "E"],
      ["C", "X", "A", "Y", "E:1"],
      ["B:L", "C:L", "D:L", "X:R", "A:R", "Y:R", "E:R"],
    );
    test(
      ["C:1", "B", "D:1"],
      ["A", "B", "C:1", "D:1"],
      ["A:R", "B:R", "C:R", "D:R"],
    );

    test(
      ["A", "B", "C", "D"],
      ["A", "C:1", "B", "D:1"],
      ["A:L", "C:R", "B:L", "D:R"],
    );

    test(
      ["C:1", "B", "D:1"],
      ["A", "B", "C:2", "D:1"],
      ["A:R", "B:L", "C:R", "D:L"],
    );

    test(
      ["A", "B", "C", "D"],
      ["C", "X", "B", "Y", "A", "Z"],
      ["C:R", "D:L", "X:R", "B:R", "Y:R", "A:R", "Z:R"],
    );

    test(
      ["A", "B", "C", "D"],
      ["A", "B:1", "C:1"],
      ["A:R", "B:R", "C:R", "D:L"],
    );

    test(
      ["A", "B", "C", "D"],
      ["A", "C:1", "B:1"],
      ["A:R", "C:R", "B:R", "D:L"],
    );

    test(
      ["A", "B", "C", "D"],
      ["A", "C:1", "B", "D:1"],
      ["A:R", "C:R", "B:R", "D:R"],
    );

    test(["A:1", "B:1", "C"], ["B:2"], ["A:L", "B:R", "C:L"]);
    test(["A:1", "B:1", "C"], ["B:2", "C:2"], ["A:L", "B:R", "C:R"]);
    test(["A", "B"], ["A", "C", "D"], ["A:R", "B:L", "C:R", "D:R"]);
    test(["A", "B"], ["B", "C", "D"], ["A:L", "B:L", "C:R", "D:R"]);
    test(["A", "B"], ["B:1"], ["A:L", "B:R"]);
    test(["A:2", "B"], ["B:1"], ["A:L", "B:R"]);
    test(["A:2", "B:2"], ["B:1"], ["A:L", "B:L"]);
    test(["A:2", "B:2"], ["B:1", "C"], ["A:L", "B:L", "C:R"]);
    test(["A:2", "B:2"], ["A", "C", "B:1"], ["A:L", "B:L", "C:R"]);
  });

  it("test identical elements reconciliation", () => {
    const testIdentical = (
      local: ElementLike[],
      remote: ElementLike[],
      expected: Id[],
    ) => {
      const ret = reconcileElements(
        local as any as OrderedExcalidrawElement[],
        remote as any as OrderedExcalidrawElement[],
        {} as AppState,
      );

      if (new Set(ret.map((x) => x.id)).size !== ret.length) {
        throw new Error("reconcileElements: duplicate elements found");
      }

      expect(ret.map((x) => x.id)).to.deep.equal(expected);
    };

    // identical id/version/versionNonce/index
    // -------------------------------------------------------------------------

    testIdentical(
      [{ id: "A", version: 1, versionNonce: 1, index: "a0" }],
      [{ id: "A", version: 1, versionNonce: 1, index: "a0" }],
      ["A"],
    );
    testIdentical(
      [
        { id: "A", version: 1, versionNonce: 1, index: "a0" },
        { id: "B", version: 1, versionNonce: 1, index: "a0" },
      ],
      [
        { id: "B", version: 1, versionNonce: 1, index: "a0" },
        { id: "A", version: 1, versionNonce: 1, index: "a0" },
      ],
      ["A", "B"],
    );

    // actually identical (arrays and element objects)
    // -------------------------------------------------------------------------

    const elements1 = [
      {
        id: "A",
        version: 1,
        versionNonce: 1,
        index: "a0",
      },
      {
        id: "B",
        version: 1,
        versionNonce: 1,
        index: "a0",
      },
    ];

    testIdentical(elements1, elements1, ["A", "B"]);
    testIdentical(elements1, elements1.slice(), ["A", "B"]);
    testIdentical(elements1.slice(), elements1, ["A", "B"]);
    testIdentical(elements1.slice(), elements1.slice(), ["A", "B"]);

    const el1 = {
      id: "A",
      version: 1,
      versionNonce: 1,
      index: "a0",
    };
    const el2 = {
      id: "B",
      version: 1,
      versionNonce: 1,
      index: "a0",
    };
    testIdentical([el1, el2], [el2, el1], ["A", "B"]);
  });
});
