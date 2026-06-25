/**
 * Predefined everyday object shapes built from Excalidraw primitives.
 * Each shape is normalized to ~120x120 at origin (0,0).
 * Elements share a groupId so they stay grouped after placement.
 *
 * IMPORTANT: element IDs here are placeholder values only. Callers MUST
 * pass these through addElementsFromPasteOrLibrary, which calls
 * duplicateElements internally to assign fresh IDs before scene commit.
 * Never pass these elements directly to scene mutation methods.
 */

type RawRect = {
  id: string;
  type: "rectangle" | "ellipse";
  x: number;
  y: number;
  width: number;
  height: number;
  groupIds: string[];
};

type RawLine = {
  id: string;
  type: "line";
  x: number;
  y: number;
  // width/height intentionally omitted — restoreElements derives them from points
  groupIds: string[];
  points: [number, number][];
};

type RawElement = RawRect | RawLine;

export type ObjectShapeData = {
  name: string;
  elements: RawElement[];
};

const r = (
  id: string,
  gid: string,
  x: number,
  y: number,
  w: number,
  h: number,
): RawRect => ({ id, type: "rectangle", x, y, width: w, height: h, groupIds: [gid] });

const el = (
  id: string,
  gid: string,
  x: number,
  y: number,
  w: number,
  h: number,
): RawRect => ({ id, type: "ellipse", x, y, width: w, height: h, groupIds: [gid] });

const ln = (
  id: string,
  gid: string,
  x: number,
  y: number,
  dx: number,
  dy: number,
): RawLine => ({
  id,
  type: "line",
  x,
  y,
  groupIds: [gid],
  points: [[0, 0], [dx, dy]],
});

// ── 1. Car ────────────────────────────────────────────────────────────────────
const CAR: ObjectShapeData = {
  name: "Car",
  elements: [
    r("car-body", "car", 0, 30, 120, 50),
    r("car-roof", "car", 25, 5, 70, 30),
    el("car-wl", "car", 10, 65, 30, 30),
    el("car-wr", "car", 80, 65, 30, 30),
  ],
};

// ── 2. Bicycle ────────────────────────────────────────────────────────────────
const BICYCLE: ObjectShapeData = {
  name: "Bicycle",
  elements: [
    el("bic-wl", "bic", 0, 40, 50, 50),
    el("bic-wr", "bic", 70, 40, 50, 50),
    ln("bic-f1", "bic", 25, 65, 45, -15), // hub-to-pedal
    ln("bic-f2", "bic", 70, 50, 25, 15),  // pedal-to-hub right
    ln("bic-st", "bic", 70, 50, -10, -20), // seat tube
    ln("bic-seat", "bic", 55, 30, 20, 0),  // seat
    ln("bic-hs", "bic", 95, 50, 0, -20),  // handlebar stem
    ln("bic-hb", "bic", 88, 30, 14, 0),   // handlebar
  ],
};

// ── 3. Human Standing ────────────────────────────────────────────────────────
const HUMAN_STANDING: ObjectShapeData = {
  name: "Person",
  elements: [
    el("hs-hd", "hs", 40, 0, 30, 30),
    r("hs-bd", "hs", 42, 32, 26, 35),
    ln("hs-al", "hs", 42, 38, -20, 20),
    ln("hs-ar", "hs", 68, 38, 20, 20),
    ln("hs-ll", "hs", 48, 67, -10, 40),
    ln("hs-lr", "hs", 62, 67, 10, 40),
  ],
};

// ── 4. Human Walking ─────────────────────────────────────────────────────────
const HUMAN_WALKING: ObjectShapeData = {
  name: "Walking",
  elements: [
    el("hw-hd", "hw", 40, 0, 30, 30),
    r("hw-bd", "hw", 42, 32, 26, 35),
    ln("hw-al", "hw", 42, 38, -22, 15),
    ln("hw-ar", "hw", 68, 38, 15, 22),
    ln("hw-ll", "hw", 48, 67, -15, 40),
    ln("hw-lr", "hw", 62, 67, 15, 40),
  ],
};

// ── 5. Human Running ─────────────────────────────────────────────────────────
const HUMAN_RUNNING: ObjectShapeData = {
  name: "Running",
  elements: [
    el("hr-hd", "hr", 45, 0, 28, 28),
    r("hr-bd", "hr", 43, 30, 24, 32),
    ln("hr-al", "hr", 43, 36, -25, 5),
    ln("hr-ar", "hr", 67, 36, 20, -15),
    ln("hr-ll", "hr", 48, 62, -20, 38),
    ln("hr-lr", "hr", 60, 62, 22, 30),
  ],
};

// ── 6. Human Waving ──────────────────────────────────────────────────────────
const HUMAN_WAVING: ObjectShapeData = {
  name: "Waving",
  elements: [
    el("hv-hd", "hv", 40, 0, 30, 30),
    r("hv-bd", "hv", 42, 32, 26, 35),
    ln("hv-al", "hv", 42, 36, -22, -20), // raised arm
    ln("hv-ar", "hv", 68, 38, 20, 20),
    ln("hv-ll", "hv", 48, 67, -8, 40),
    ln("hv-lr", "hv", 62, 67, 8, 40),
  ],
};

// ── 7. House ─────────────────────────────────────────────────────────────────
const HOUSE: ObjectShapeData = {
  name: "House",
  elements: [
    r("ho-bd", "ho", 10, 50, 100, 70),
    ln("ho-rl", "ho", 60, 10, -50, 40), // roof left slope
    ln("ho-rr", "ho", 60, 10, 50, 40),  // roof right slope
    ln("ho-rb", "ho", 10, 50, 100, 0),  // roof base
    r("ho-dr", "ho", 47, 90, 26, 30),   // door
  ],
};

// ── 8. Tree ───────────────────────────────────────────────────────────────────
const TREE: ObjectShapeData = {
  name: "Tree",
  elements: [
    el("tr-cn", "tr", 15, 0, 80, 75),
    r("tr-tk", "tr", 47, 70, 16, 45),
  ],
};

// ── 9. Table ─────────────────────────────────────────────────────────────────
const TABLE: ObjectShapeData = {
  name: "Table",
  elements: [
    r("tb-tp", "tb", 0, 20, 120, 15),
    ln("tb-l1", "tb", 10, 35, 0, 65),
    ln("tb-l2", "tb", 110, 35, 0, 65),
    ln("tb-l3", "tb", 25, 35, 0, 55),
    ln("tb-l4", "tb", 95, 35, 0, 55),
  ],
};

// ── 10. Phone ────────────────────────────────────────────────────────────────
const PHONE: ObjectShapeData = {
  name: "Phone",
  elements: [
    r("ph-bd", "ph", 25, 0, 70, 120),
    el("ph-cm", "ph", 55, 8, 10, 10),
    ln("ph-br", "ph", 45, 108, 30, 0), // home bar
    r("ph-sc", "ph", 32, 22, 56, 78),  // screen
  ],
};

export const OBJECT_SHAPES: ObjectShapeData[] = [
  CAR,
  BICYCLE,
  HUMAN_STANDING,
  HUMAN_WALKING,
  HUMAN_RUNNING,
  HUMAN_WAVING,
  HOUSE,
  TREE,
  TABLE,
  PHONE,
];
