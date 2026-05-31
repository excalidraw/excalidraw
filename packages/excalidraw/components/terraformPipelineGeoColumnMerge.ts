/**
 * Iterative adjacent column-run merge for pipeline geo hierarchy levels.
 */

export type PipelineColumnSpec = {
  columnIndex: number;
};

export type PipelineColumnRun<T> = {
  key: string;
  minColumn: number;
  maxColumn: number;
  items: T[];
};

/** For each column, the set of hierarchy keys present at this level. */
export function buildColumnOccupancy<T extends PipelineColumnSpec>(
  specs: readonly T[],
  keyFn: (spec: T) => string,
): Map<number, Set<string>> {
  const occupancy = new Map<number, Set<string>>();
  for (const spec of specs) {
    const key = keyFn(spec);
    const keys = occupancy.get(spec.columnIndex) ?? new Set<string>();
    keys.add(key);
    occupancy.set(spec.columnIndex, keys);
  }
  return occupancy;
}

function spanIsPureForKey(
  minColumn: number,
  maxColumn: number,
  key: string,
  occupancy: ReadonlyMap<number, Set<string>>,
): boolean {
  for (let column = minColumn; column <= maxColumn; column++) {
    const keysAtCol = occupancy.get(column) ?? new Set<string>();
    if (
      keysAtCol.size > 0 &&
      !(keysAtCol.size === 1 && keysAtCol.has(key))
    ) {
      return false;
    }
  }
  return true;
}

/** Seed one single-column run per (hierarchyKey, columnIndex) that has specs. */
export function seedColumnRunsFromSpecs<T extends PipelineColumnSpec>(
  specs: readonly T[],
  keyFn: (spec: T) => string,
): PipelineColumnRun<T>[] {
  const byKeyColumn = new Map<string, Map<number, T[]>>();

  for (const spec of specs) {
    const key = keyFn(spec);
    let colMap = byKeyColumn.get(key);
    if (!colMap) {
      colMap = new Map();
      byKeyColumn.set(key, colMap);
    }
    const list = colMap.get(spec.columnIndex) ?? [];
    list.push(spec);
    colMap.set(spec.columnIndex, list);
  }

  const runs: PipelineColumnRun<T>[] = [];
  for (const [key, colMap] of byKeyColumn) {
    for (const [columnIndex, items] of colMap) {
      runs.push({
        key,
        minColumn: columnIndex,
        maxColumn: columnIndex,
        items: [...items],
      });
    }
  }

  return runs.sort(
    (a, b) =>
      a.key.localeCompare(b.key) || a.minColumn - b.minColumn,
  );
}

/** Merge adjacent runs with the same key when the merged span is hierarchy-pure. */
export function mergeAdjacentColumnRunsIteratively<T>(
  runs: readonly PipelineColumnRun<T>[],
  occupancy: ReadonlyMap<number, Set<string>>,
): PipelineColumnRun<T>[] {
  let current = runs.map((run) => ({
    key: run.key,
    minColumn: run.minColumn,
    maxColumn: run.maxColumn,
    items: [...run.items],
  }));

  let changed = true;
  while (changed) {
    changed = false;
    current.sort(
      (a, b) =>
        a.key.localeCompare(b.key) || a.minColumn - b.minColumn,
    );

    const next: PipelineColumnRun<T>[] = [];
    for (let i = 0; i < current.length; ) {
      let run = current[i]!;
      while (i + 1 < current.length) {
        const candidate = current[i + 1]!;
        if (
          candidate.key !== run.key ||
          candidate.minColumn !== run.maxColumn + 1
        ) {
          break;
        }
        const mergedMin = run.minColumn;
        const mergedMax = candidate.maxColumn;
        if (!spanIsPureForKey(mergedMin, mergedMax, run.key, occupancy)) {
          break;
        }
        run = {
          key: run.key,
          minColumn: mergedMin,
          maxColumn: mergedMax,
          items: [...run.items, ...candidate.items],
        };
        i += 1;
        changed = true;
      }
      next.push(run);
      i += 1;
    }
    current = next;
  }

  return current;
}
