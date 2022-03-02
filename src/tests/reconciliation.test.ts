import { expect } from "chai";
import { ExcalidrawElement } from "../element/types";
import {
  BroadcastedExcalidrawElement,
  ReconciledElements,
  reconcileElements,
} from "../excalidraw-app/collab/reconciliation";
import { randomInteger } from "../random";
import { AppState } from "../types";

type Id = string;
type Ids = Id[];

type Cache = Record<string, ExcalidrawElement | undefined>;

const parseId = (uid: string) => {
  const [, parent, id, version] = uid.match(
    /^(?:\((\^|\w+)\))?(\w+)(?::(\d+))?(?:\((\w+)\))?$/,
  )!;
  return {
    uid: version ? `${id}:${version}` : id,
    id,
    version: version ? parseInt(version) : null,
    parent: parent || null,
  };
};

const idsToElements = (
  ids: Ids,
  cache: Cache = {},
): readonly ExcalidrawElement[] => {
  return ids.reduce((acc, _uid, idx) => {
    const { uid, id, version, parent } = parseId(_uid);
    const cached = cache[uid];
    const elem = {
      id,
      version: version ?? 0,
      versionNonce: randomInteger(),
      ...cached,
      parent,
    } as BroadcastedExcalidrawElement;
    cache[uid] = elem;
    acc.push(elem);
    return acc;
  }, [] as ExcalidrawElement[]);
};

const addParents = (elements: BroadcastedExcalidrawElement[]) => {
  return elements.map((el, idx, els) => {
    el.parent = els[idx - 1]?.id || "^";
    return el;
  });
};

const cleanElements = (elements: ReconciledElements) => {
  return elements.map((el) => {
    // @ts-ignore
    delete el.parent;
    // @ts-ignore
    delete el.next;
    // @ts-ignore
    delete el.prev;
    return el;
  });
};

const cloneDeep = (data: any) => JSON.parse(JSON.stringify(data));

const test = <U extends `${string}:${"L" | "R"}`>(
  local: Ids,
  remote: Ids,
  target: U[],
  bidirectional = true,
) => {
  const cache: Cache = {};
  const _local = idsToElements(local, cache);
  const _remote = idsToElements(remote, cache);
  const _target = target.map((uid) => {
    const [, id, source] = uid.match(/^(\w+):([LR])$/)!;
    return (source === "L" ? _local : _remote).find((e) => e.id === id)!;
  }) as any as ReconciledElements;
  const remoteReconciled = reconcileElements(_local, _remote, {} as AppState);
  expect(cleanElements(remoteReconciled)).deep.equal(
    cleanElements(_target),
    "remote reconciliation",
  );

  const __local = cleanElements(cloneDeep(_remote));
  const __remote = addParents(cleanElements(cloneDeep(remoteReconciled)));
  if (bidirectional) {
    try {
      expect(
        cleanElements(
          reconcileElements(
            cloneDeep(__local),
            cloneDeep(__remote),
            {} as AppState,
          ),
        ),
      ).deep.equal(cleanElements(remoteReconciled), "local re-reconciliation");
    } catch (error: any) {
      console.error("local original", __local);
      console.error("remote reconciled", __remote);
      throw error;
    }
  }
};

export const findIndex = <T>(
  array: readonly T[],
  cb: (element: T, index: number, array: readonly T[]) => boolean,
  fromIndex: number = 0,
) => {
  if (fromIndex < 0) {
    fromIndex = array.length + fromIndex;
  }
  fromIndex = Math.min(array.length, Math.max(fromIndex, 0));
  let index = fromIndex - 1;
  while (++index < array.length) {
    if (cb(array[index], index, array)) {
      return index;
    }
  }
  return -1;
};

// -----------------------------------------------------------------------------

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

    // non-annotated elements
    // -------------------------------------------------------------------------
    // usually when we sync elements they should always be annotated with
    // their (preceding elements) parents, but let's test a couple of cases when
    // they're not for whatever reason (remote clients are on older version...),
    // in which case the first synced element either replaces existing element
    // or is pushed at the end of the array

    test(["A:1", "B:1", "C:1"], ["B:2"], ["A:L", "B:R", "C:L"]);
    test(["A:1", "B:1", "C"], ["B:2", "A:2"], ["B:R", "A:R", "C:L"]);
    test(["A:2", "B:1", "C"], ["B:2", "A:1"], ["A:L", "B:R", "C:L"]);
    test(["A:1", "B:1"], ["C:1"], ["A:L", "B:L", "C:R"]);
    test(["A", "B"], ["A:1"], ["A:R", "B:L"]);
    test(["A"], ["A", "B"], ["A:L", "B:R"]);
    test(["A"], ["A:1", "B"], ["A:R", "B:R"]);
    test(["A:2"], ["A:1", "B"], ["A:L", "B:R"]);
    test(["A:2"], ["B", "A:1"], ["A:L", "B:R"]);
    test(["A:1"], ["B", "A:2"], ["B:R", "A:R"]);
    test(["A"], ["A:1"], ["A:R"]);

    // C isn't added to the end because it follows B (even if B was resolved
    // to local version)
    test(["A", "B:1", "D"], ["B", "C:2", "A"], ["B:L", "C:R", "A:R", "D:L"]);

    // some of the following tests are kinda arbitrary and they're less
    // likely to happen in real-world cases

    test(["A", "B"], ["B:1", "A:1"], ["B:R", "A:R"]);
    test(["A:2", "B:2"], ["B:1", "A:1"], ["A:L", "B:L"]);
    test(["A", "B", "C"], ["A", "B:2", "G", "C"], ["A:L", "B:R", "G:R", "C:L"]);
    test(["A", "B", "C"], ["A", "B:2", "G"], ["A:L", "B:R", "G:R", "C:L"]);
    test(["A", "B", "C"], ["A", "B:2", "G"], ["A:L", "B:R", "G:R", "C:L"]);
    test(
      ["A:2", "B:2", "C"],
      ["D", "B:1", "A:3"],
      ["B:L", "A:R", "C:L", "D:R"],
    );
    test(
      ["A:2", "B:2", "C"],
      ["D", "B:2", "A:3", "C"],
      ["D:R", "B:L", "A:R", "C:L"],
    );
    test(
      ["A", "B", "C", "D", "E", "F"],
      ["A", "B:2", "X", "E:2", "F", "Y"],
      ["A:L", "B:R", "X:R", "E:R", "F:L", "Y:R", "C:L", "D:L"],
    );

    // annotated elements
    // -------------------------------------------------------------------------

    test(
      ["A", "B", "C"],
      ["(B)X", "(A)Y", "(Y)Z"],
      ["A:L", "B:L", "X:R", "Y:R", "Z:R", "C:L"],
    );

    test(["A"], ["(^)X", "Y"], ["X:R", "Y:R", "A:L"]);
    test(["A"], ["(^)X", "Y", "Z"], ["X:R", "Y:R", "Z:R", "A:L"]);

    test(
      ["A", "B"],
      ["(A)C", "(^)D", "F"],
      ["A:L", "C:R", "D:R", "F:R", "B:L"],
    );

    test(
      ["A", "B", "C", "D"],
      ["(B)C:1", "B", "D:1"],
      ["A:L", "C:R", "B:L", "D:R"],
    );

    test(
      ["A", "B", "C"],
      ["(^)X", "(A)Y", "(B)Z"],
      ["X:R", "A:L", "Y:R", "B:L", "Z:R", "C:L"],
    );

    test(
      ["B", "A", "C"],
      ["(^)X", "(A)Y", "(B)Z"],
      ["X:R", "B:L", "A:L", "Y:R", "Z:R", "C:L"],
    );

    test(["A", "B"], ["(A)X", "(A)Y"], ["A:L", "X:R", "Y:R", "B:L"]);

    test(
      ["A", "B", "C", "D", "E"],
      ["(A)X", "(C)Y", "(D)Z"],
      ["A:L", "X:R", "B:L", "C:L", "Y:R", "D:L", "Z:R", "E:L"],
    );

    test(
      ["X", "Y", "Z"],
      ["(^)A", "(A)B", "(B)C", "(C)X", "(X)D", "(D)Y", "(Y)Z"],
      ["A:R", "B:R", "C:R", "X:L", "D:R", "Y:L", "Z:L"],
    );

    test(
      ["A", "B", "C", "D", "E"],
      ["(C)X", "(A)Y", "(D)E:1"],
      ["A:L", "B:L", "C:L", "X:R", "Y:R", "D:L", "E:R"],
    );

    test(
      ["C:1", "B", "D:1"],
      ["A", "B", "C:1", "D:1"],
      ["A:R", "B:L", "C:L", "D:L"],
    );

    test(
      ["A", "B", "C", "D"],
      ["(A)C:1", "(C)B", "(B)D:1"],
      ["A:L", "C:R", "B:L", "D:R"],
    );

    test(
      ["A", "B", "C", "D"],
      ["(A)C:1", "(C)B", "(B)D:1"],
      ["A:L", "C:R", "B:L", "D:R"],
    );

    test(
      ["C:1", "B", "D:1"],
      ["(^)A", "(A)B", "(B)C:2", "(C)D:1"],
      ["A:R", "B:L", "C:R", "D:L"],
    );

    test(
      ["A", "B", "C", "D"],
      ["(C)X", "(B)Y", "(A)Z"],
      ["A:L", "B:L", "C:L", "X:R", "Y:R", "Z:R", "D:L"],
    );

    test(["A", "B", "C", "D"], ["(A)B:1", "C:1"], ["A:L", "B:R", "C:R", "D:L"]);
    test(["A", "B", "C", "D"], ["(A)C:1", "B:1"], ["A:L", "C:R", "B:R", "D:L"]);
    test(
      ["A", "B", "C", "D"],
      ["(A)C:1", "B", "D:1"],
      ["A:L", "C:R", "B:L", "D:R"],
    );

    test(["A:1", "B:1", "C"], ["B:2"], ["A:L", "B:R", "C:L"]);
    test(["A:1", "B:1", "C"], ["B:2", "C:2"], ["A:L", "B:R", "C:R"]);

    test(["A", "B"], ["(A)C", "(B)D"], ["A:L", "C:R", "B:L", "D:R"]);
    test(["A", "B"], ["(X)C", "(X)D"], ["A:L", "B:L", "C:R", "D:R"]);
    test(["A", "B"], ["(X)C", "(A)D"], ["A:L", "D:R", "B:L", "C:R"]);
    test(["A", "B"], ["(A)B:1"], ["A:L", "B:R"]);
    test(["A:2", "B"], ["(A)B:1"], ["A:L", "B:R"]);
    test(["A:2", "B:2"], ["B:1"], ["A:L", "B:L"]);
    test(["A:2", "B:2"], ["B:1", "C"], ["A:L", "B:L", "C:R"]);
    test(["A:2", "B:2"], ["(A)C", "B:1"], ["A:L", "C:R", "B:L"]);
    test(["A:2", "B:2"], ["(A)C", "B:1"], ["A:L", "C:R", "B:L"]);
  });
});
