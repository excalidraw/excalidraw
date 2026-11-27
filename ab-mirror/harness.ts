// Parent page: mirrors trusted input from the pane you use into the other one,
// compares the two scenes, and draws the other pane's routes as ghosts.
//
// Both panes are same-origin iframes, so we listen on their windows directly
// (capture phase, passive) and re-dispatch synthetic copies into the other
// pane. Synthetic events are untrusted, which is how we avoid echoes.

type Side = "left" | "right";

type EditorWindow = Window &
  typeof globalThis & {
    ab?: {
      side: Side;
      EX: any;
      api: any;
      ready: Promise<void>;
      subscribe: (cb: () => void) => () => void;
    };
  };

type Pane = {
  side: Side;
  section: HTMLElement;
  iframe: HTMLIFrameElement;
  svg: SVGSVGElement;
  cursor: HTMLElement;
  label: HTMLElement;
  win: EditorWindow | null;
  api: any;
  EX: any;
  unsubscribe: (() => void) | null;
  generation: number;
};

/** as resolved by ab.mjs */
type Tree = {
  side: Side;
  /** a commit snapshot, or a checkout used live */
  kind: "commit" | "dir";
  root: string;
  label: string;
  sha: string;
  subject: string;
  dirty: boolean;
  warning: string;
};

type DiffKind = "count" | "type" | "route" | "binding" | "shape";

type DiffItem = {
  index: number;
  kind: DiffKind;
  text: string;
  left?: any;
  right?: any;
};

const ROUTE_EPS = 0.5;
const SHAPE_EPS = 0.5;
const SVG_NS = "http://www.w3.org/2000/svg";

const POINTER_EVENTS = [
  "pointerdown",
  "pointermove",
  "pointerup",
  "pointercancel",
  "pointerover",
  "pointerout",
  "pointerenter",
  "pointerleave",
];
const MOUSE_EVENTS = [
  "mousedown",
  "mouseup",
  "click",
  "auxclick",
  "dblclick",
  "contextmenu",
];
const KEY_EVENTS = ["keydown", "keyup"];
// `copy` isn't forwarded: it doesn't change the scene, and the unfocused
// pane's clipboard write would only fail
const CLIPBOARD_EVENTS = ["paste", "cut"];
const FORM_EVENTS = ["input", "change"];
// only forwarded for text fields (the text editor submits on blur)
const FOCUS_EVENTS = ["blur", "focusout"];
const ALL_EVENTS = [
  ...POINTER_EVENTS,
  ...MOUSE_EVENTS,
  "wheel",
  ...KEY_EVENTS,
  ...CLIPBOARD_EVENTS,
  ...FORM_EVENTS,
  ...FOCUS_EVENTS,
];

// appState kept equal from the leader whenever the panes are idle (a safety
// net: mirrored input normally keeps these in step on its own)
const GUARDED_APPSTATE = [
  "theme",
  "gridModeEnabled",
  "gridSize",
  "gridStep",
  "objectsSnapModeEnabled",
  "currentItemArrowType",
] as const;

const CLEAR_SELECTION = {
  selectedElementIds: {},
  selectedGroupIds: {},
  selectedLinearElement: null,
  editingGroupId: null,
};

// -----------------------------------------------------------------------------
// DOM
// -----------------------------------------------------------------------------

const $ = <T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
) => root.querySelector(selector) as T;

const makePane = (side: Side): Pane => {
  const section = $(`.pane[data-side="${side}"]`);
  return {
    side,
    section,
    iframe: $("iframe", section),
    svg: $("svg.ghosts", section),
    cursor: $(".cursor", section),
    label: $(".pane-label", section),
    win: null,
    api: null,
    EX: null,
    unsubscribe: null,
    generation: 0,
  };
};

const panes: Record<Side, Pane> = {
  left: makePane("left"),
  right: makePane("right"),
};

const otherSide = (side: Side): Side => (side === "left" ? "right" : "left");

const ui = {
  mirror: $<HTMLInputElement>("#mirror"),
  ghosts: $<HTMLInputElement>("#ghosts"),
  status: $("#status"),
  diffSummary: $("#diff-summary"),
  diffList: $("#diff-list"),
  log: $("#log"),
  file: $<HTMLInputElement>("#file"),
};

const log = (message: string, level: "info" | "warn" = "info") => {
  const li = document.createElement("li");
  li.className = level;
  li.textContent = `${new Date().toLocaleTimeString()}  ${message}`;
  ui.log.prepend(li);
  while (ui.log.childElementCount > 40) {
    ui.log.lastElementChild!.remove();
  }
  (level === "warn" ? console.warn : console.info)(`[ab] ${message}`);
};

// -----------------------------------------------------------------------------
// input mirroring
// -----------------------------------------------------------------------------

/** pane that got the latest trusted pointer input */
let leader: Side = "left";
/** pane the user last pressed in: the only one allowed to move focus */
let lastPressSide: Side = "left";
/** a pointer button is held in the leader */
let pointerIsDown = false;

const paneOfWindow = (win: Window) =>
  Object.values(panes).find((pane) => pane.win === win) ?? null;

// consulted by the panes' patched focus() (see host.tsx)
(window as any).__abFocusGate = (win: Window) => {
  const pane = paneOfWindow(win);
  return !pane || pane.side === lastPressSide || win.document.hasFocus();
};

const setLeader = (side: Side) => {
  leader = side;
  for (const pane of Object.values(panes)) {
    pane.section.classList.toggle("leader", pane.side === side);
    if (pane.side === side) {
      pane.cursor.hidden = true;
    }
  }
};

const pathOf = (el: Element) => {
  const path: number[] = [];
  let node: Element | null = el;
  while (node?.parentElement) {
    path.unshift(
      Array.prototype.indexOf.call(node.parentElement.children, node),
    );
    node = node.parentElement;
  }
  return path;
};

const resolvePath = (doc: Document, path: number[]) => {
  let node: Element | null = doc.documentElement;
  for (const index of path) {
    node = node?.children[index] ?? null;
    if (!node) {
      return null;
    }
  }
  return node;
};

const isPointerish = (event: Event): event is MouseEvent => "clientX" in event;

const isTextField = (target: EventTarget | null, win: EditorWindow) =>
  target instanceof win.HTMLTextAreaElement ||
  target instanceof win.HTMLSelectElement ||
  (target instanceof win.HTMLInputElement &&
    !["checkbox", "radio", "file", "button", "submit"].includes(target.type)) ||
  (target instanceof win.HTMLElement && target.isContentEditable);

/** the node in `to` that corresponds to the source event's target */
const mapTarget = (event: Event, from: Pane, to: Pane): EventTarget | null => {
  const fromWin = from.win!;
  const toWin = to.win!;
  const doc = toWin.document;
  const src = event.target;

  if (src === fromWin) {
    return toWin;
  }
  if (src === fromWin.document) {
    return doc;
  }
  if (!(src instanceof fromWin.Element)) {
    return null;
  }
  if (src.matches("textarea.excalidraw-wysiwyg")) {
    return doc.querySelector("textarea.excalidraw-wysiwyg");
  }
  if (src.matches("canvas.excalidraw__canvas.interactive")) {
    return doc.querySelector("canvas.excalidraw__canvas.interactive");
  }
  if (src === fromWin.document.body) {
    return doc.body;
  }
  if (src === fromWin.document.documentElement) {
    return doc.documentElement;
  }
  // the target is what's under the pointer (not captured, not a leave):
  // take what's under the same point in the other pane
  if (
    isPointerish(event) &&
    fromWin.document.elementFromPoint(event.clientX, event.clientY) === src
  ) {
    const hit = doc.elementFromPoint(event.clientX, event.clientY);
    if (hit) {
      return hit;
    }
  }
  const viaPath = resolvePath(doc, pathOf(src));
  if (viaPath && viaPath.tagName === src.tagName) {
    return viaPath;
  }
  if (isPointerish(event)) {
    return doc.elementFromPoint(event.clientX, event.clientY);
  }
  return doc.activeElement ?? doc.body;
};

const mouseInit = (event: MouseEvent, W: EditorWindow): MouseEventInit => ({
  bubbles: event.bubbles,
  cancelable: event.cancelable,
  composed: event.composed,
  view: W,
  detail: event.detail,
  screenX: event.screenX,
  screenY: event.screenY,
  clientX: event.clientX,
  clientY: event.clientY,
  movementX: event.movementX,
  movementY: event.movementY,
  ctrlKey: event.ctrlKey,
  shiftKey: event.shiftKey,
  altKey: event.altKey,
  metaKey: event.metaKey,
  button: event.button,
  buttons: event.buttons,
  relatedTarget: null,
});

const pointerInit = (
  event: PointerEvent,
  W: EditorWindow,
): PointerEventInit => ({
  ...mouseInit(event, W),
  pointerId: event.pointerId,
  pointerType: event.pointerType,
  isPrimary: event.isPrimary,
  width: event.width,
  height: event.height,
  pressure: event.pressure,
  tangentialPressure: event.tangentialPressure,
  tiltX: event.tiltX,
  tiltY: event.tiltY,
  twist: event.twist,
});

const copyKeyboardEvent = (event: KeyboardEvent, W: EditorWindow) => {
  const copy = new W.KeyboardEvent(event.type, {
    bubbles: event.bubbles,
    cancelable: event.cancelable,
    composed: event.composed,
    view: W,
    key: event.key,
    code: event.code,
    location: event.location,
    repeat: event.repeat,
    isComposing: event.isComposing,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
  });
  // not settable through the init dict
  for (const prop of ["keyCode", "which", "charCode"] as const) {
    Object.defineProperty(copy, prop, { value: event[prop] });
  }
  return copy;
};

const copyClipboardEvent = (event: ClipboardEvent, W: EditorWindow) => {
  const data = new W.DataTransfer();
  if (event.type === "paste" && event.clipboardData) {
    for (const type of event.clipboardData.types) {
      if (type !== "Files") {
        data.setData(type, event.clipboardData.getData(type));
      }
    }
    for (const file of Array.from(event.clipboardData.files)) {
      data.items.add(file);
    }
  }
  return new W.ClipboardEvent(event.type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    clipboardData: data,
  });
};

/**
 * The follower never gets real focus (see the focus gate), yet handlers check
 * `document.activeElement` (paste/cut bail out unless it's inside the editor,
 * key handlers skip text fields). For the synchronous part of the dispatch,
 * the follower's activeElement is made the counterpart of the leader's.
 */
const withMirroredFocus = (from: Pane, to: Pane, dispatch: () => void) => {
  const doc = to.win!.document;
  const active = from.win!.document.activeElement;
  if (doc.hasFocus() || !active) {
    dispatch();
    return;
  }
  const counterpart = active.matches("textarea.excalidraw-wysiwyg")
    ? doc.querySelector("textarea.excalidraw-wysiwyg")
    : active === from.win!.document.body
    ? doc.body
    : resolvePath(doc, pathOf(active));
  if (!counterpart || counterpart.tagName !== active.tagName) {
    dispatch();
    return;
  }
  Object.defineProperty(doc, "activeElement", {
    configurable: true,
    get: () => counterpart,
  });
  try {
    dispatch();
  } finally {
    delete (doc as any).activeElement;
  }
};

const forwardFormEvent = (event: Event, from: Pane, to: Pane) => {
  const W = to.win!;
  const src = event.target;
  if (!isTextField(src, from.win!)) {
    // checkboxes/radios follow the forwarded click
    return;
  }
  const dst = mapTarget(event, from, to);
  if (!dst || !isTextField(dst, W) || !("value" in (dst as any))) {
    return;
  }
  const source = src as HTMLInputElement | HTMLTextAreaElement;
  const target = dst as HTMLInputElement | HTMLTextAreaElement;
  // the prototype setter, so React sees the change
  const proto =
    target instanceof W.HTMLTextAreaElement
      ? W.HTMLTextAreaElement.prototype
      : target instanceof W.HTMLSelectElement
      ? W.HTMLSelectElement.prototype
      : W.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(
    target,
    source.value,
  );
  try {
    if (source.selectionStart != null) {
      target.setSelectionRange(source.selectionStart, source.selectionEnd);
    }
  } catch {
    // not a text-like input
  }
  const copy =
    event.type === "input"
      ? new W.InputEvent("input", {
          bubbles: true,
          composed: true,
          inputType: (event as InputEvent).inputType,
          data: (event as InputEvent).data,
        })
      : new W.Event("change", { bubbles: true });
  withMirroredFocus(from, to, () => target.dispatchEvent(copy));
};

const forward = (event: Event, from: Pane, to: Pane) => {
  const W = to.win!;
  const S = from.win!;
  const type = event.type;

  if (FORM_EVENTS.includes(type)) {
    forwardFormEvent(event, from, to);
    return;
  }

  if (FOCUS_EVENTS.includes(type)) {
    if (!isTextField(event.target, S)) {
      return;
    }
    const target = mapTarget(event, from, to);
    if (target) {
      const copy = new W.FocusEvent(type, {
        bubbles: type === "focusout",
        composed: true,
      });
      withMirroredFocus(from, to, () => target.dispatchEvent(copy));
    }
    return;
  }

  const target = mapTarget(event, from, to);
  if (!target) {
    return;
  }

  let copy: Event;
  if (event instanceof S.WheelEvent) {
    copy = new W.WheelEvent(type, {
      ...mouseInit(event, W),
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaZ: event.deltaZ,
      deltaMode: event.deltaMode,
    });
  } else if (event instanceof S.PointerEvent) {
    copy = new W.PointerEvent(type, pointerInit(event, W));
  } else if (event instanceof S.MouseEvent) {
    copy = new W.MouseEvent(type, mouseInit(event, W));
  } else if (event instanceof S.KeyboardEvent) {
    copy = copyKeyboardEvent(event, W);
  } else if (event instanceof S.ClipboardEvent) {
    copy = copyClipboardEvent(event, W);
  } else {
    return;
  }

  withMirroredFocus(from, to, () => target.dispatchEvent(copy));

  if (isPointerish(event)) {
    showCursor(to, event);
  }
};

const showCursor = (pane: Pane, event: MouseEvent) => {
  if (event.type === "pointerout" && !(event as PointerEvent).relatedTarget) {
    // left the source iframe
    pane.cursor.hidden = true;
    return;
  }
  pane.cursor.hidden = false;
  pane.cursor.style.left = `${event.clientX}px`;
  pane.cursor.style.top = `${event.clientY}px`;
  pane.cursor.classList.toggle("down", event.buttons !== 0);
};

const onSourceEvent = (from: Pane, event: Event) => {
  if (!event.isTrusted) {
    return;
  }
  const type = event.type;

  if (type === "pointerdown" || type === "mousedown") {
    lastPressSide = from.side;
  }
  if (isPointerish(event) && !FOCUS_EVENTS.includes(type)) {
    if (leader !== from.side) {
      setLeader(from.side);
    }
    if (POINTER_EVENTS.includes(type) && !/over|out|enter|leave/.test(type)) {
      pointerIsDown = event.buttons !== 0 && type !== "pointerup";
    }
  }

  if (!ui.mirror.checked) {
    return;
  }
  const to = panes[otherSide(from.side)];
  if (!to.win || !to.api) {
    return;
  }
  try {
    forward(event, from, to);
  } catch (error) {
    console.warn(`[ab] forwarding ${type} to ${to.side} failed`, error);
  }
};

// -----------------------------------------------------------------------------
// pane lifecycle
// -----------------------------------------------------------------------------

const attach = async (pane: Pane) => {
  const win = pane.iframe.contentWindow as EditorWindow | null;
  if (!win) {
    return;
  }
  const generation = ++pane.generation;
  pane.unsubscribe?.();
  pane.unsubscribe = null;
  pane.win = win;
  pane.api = null;

  const handler = (event: Event) => onSourceEvent(pane, event);
  for (const type of ALL_EVENTS) {
    win.addEventListener(type, handler, { capture: true, passive: true });
  }

  if (!win.ab) {
    log(
      `${pane.side}: editor page failed to load (see the iframe's console)`,
      "warn",
    );
    return;
  }
  await win.ab.ready;
  if (generation !== pane.generation) {
    return;
  }
  pane.api = win.ab.api;
  pane.EX = win.ab.EX;
  pane.unsubscribe = win.ab.subscribe(scheduleUpdate);
  if (generation > 1) {
    log(
      `${pane.side} reloaded (HMR full reload?) — its scene is empty now; copy the other pane over to resync`,
      "warn",
    );
  } else {
    log(`${pane.side} ready`);
  }
  scheduleUpdate();
};

// -----------------------------------------------------------------------------
// comparison
// -----------------------------------------------------------------------------

const absPoints = (el: any): [number, number][] =>
  (el.points ?? []).map((p: [number, number]) => [el.x + p[0], el.y + p[1]]);

const bindingSig = (binding: any, indexOf: Map<string, number>) => {
  if (!binding) {
    return "free";
  }
  const fixedPoint = binding.fixedPoint
    ? `(${binding.fixedPoint.map((v: number) => v.toFixed(2)).join(",")})`
    : "";
  return `${binding.mode ?? "?"}${fixedPoint}@#${
    indexOf.get(binding.elementId) ?? "?"
  }`;
};

const compareScenes = (le: readonly any[], re: readonly any[]) => {
  const items: DiffItem[] = [];
  const indexL = new Map(le.map((el, i) => [el.id, i]));
  const indexR = new Map(re.map((el, i) => [el.id, i]));

  if (le.length !== re.length) {
    items.push({
      index: -1,
      kind: "count",
      text: `element count: L ${le.length} | R ${re.length} (z-order pairing is off from the first extra one)`,
    });
  }

  let arrows = 0;
  const n = Math.min(le.length, re.length);
  for (let i = 0; i < n; i++) {
    const a = le[i];
    const b = re[i];
    if (a.type !== b.type || !!a.elbowed !== !!b.elbowed) {
      items.push({
        index: i,
        kind: "type",
        text: `#${i}: L ${a.type}${a.elbowed ? " (elbow)" : ""} | R ${b.type}${
          b.elbowed ? " (elbow)" : ""
        }`,
      });
      continue;
    }

    if (a.type === "arrow") {
      arrows++;
      const name = `#${i} ${a.elbowed ? "elbow" : "arrow"}`;
      const sigL = `${bindingSig(a.startBinding, indexL)} → ${bindingSig(
        a.endBinding,
        indexL,
      )}`;
      const sigR = `${bindingSig(b.startBinding, indexR)} → ${bindingSig(
        b.endBinding,
        indexR,
      )}`;
      if (sigL !== sigR) {
        items.push({
          index: i,
          kind: "binding",
          text: `${name}: L ${sigL} | R ${sigR}`,
          left: a,
          right: b,
        });
      }

      const pa = absPoints(a);
      const pb = absPoints(b);
      const delta =
        pa.length !== pb.length
          ? Infinity
          : Math.max(
              0,
              ...pa.map((p, k) => Math.hypot(p[0] - pb[k][0], p[1] - pb[k][1])),
            );
      if (delta > ROUTE_EPS) {
        const segs = (el: any) =>
          el.fixedSegments?.length
            ? `, ${el.fixedSegments.length} fixed seg`
            : "";
        items.push({
          index: i,
          kind: "route",
          text: `${name}: L ${pa.length} pts${segs(a)} | R ${
            pb.length
          } pts${segs(b)}${
            Number.isFinite(delta) ? ` · max Δ ${delta.toFixed(1)}` : ""
          }`,
          left: a,
          right: b,
        });
      }
      continue;
    }

    const delta = Math.max(
      Math.abs(a.x - b.x),
      Math.abs(a.y - b.y),
      Math.abs(a.width - b.width),
      Math.abs(a.height - b.height),
    );
    if (delta > SHAPE_EPS || Math.abs(a.angle - b.angle) > 1e-3) {
      items.push({
        index: i,
        kind: "shape",
        text: `#${i} ${a.type}: geometry differs (Δ ${delta.toFixed(1)})`,
        left: a,
        right: b,
      });
    }
  }

  return { items, arrows, counts: { left: le.length, right: re.length } };
};

const renderReport = (result: ReturnType<typeof compareScenes>) => {
  const { items, arrows, counts } = result;
  const byKind = (kind: DiffKind) =>
    items.filter((item) => item.kind === kind).length;

  if (!items.length) {
    ui.diffSummary.textContent = `✓ identical — ${counts.left} elements, ${arrows} arrows`;
    ui.diffSummary.className = "ok";
    ui.status.textContent = "✓ in sync";
    ui.status.className = "ok";
  } else {
    const parts = (
      [
        ["route", "route"],
        ["binding", "binding"],
        ["shape", "shape"],
        ["type", "type"],
        ["count", "count"],
      ] as const
    )
      .map(([kind, label]) => [byKind(kind), label] as const)
      .filter(([count]) => count > 0)
      .map(([count, label]) => `${count} ${label}`);
    ui.diffSummary.textContent = `≠ ${parts.join(", ")} difference(s) — L ${
      counts.left
    } / R ${counts.right} elements, ${arrows} arrows`;
    ui.diffSummary.className = "bad";
    ui.status.textContent = `≠ ${items.length} diff`;
    ui.status.className = "bad";
  }

  ui.diffList.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement("li");
      li.className = `kind-${item.kind}`;
      const kind = document.createElement("span");
      kind.className = "kind";
      kind.textContent = item.kind;
      li.append(kind, item.text);
      return li;
    }),
  );
};

const svgEl = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
) => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
};

/** draws, in each pane, the *other* pane's version of each differing element */
const renderGhosts = (items: DiffItem[]) => {
  for (const pane of Object.values(panes)) {
    pane.svg.replaceChildren();
    if (!ui.ghosts.checked || !pane.api) {
      continue;
    }
    const { scrollX, scrollY, zoom } = pane.api.getAppState();
    const toView = ([x, y]: [number, number]) => [
      (x + scrollX) * zoom.value,
      (y + scrollY) * zoom.value,
    ];
    const drawn = new Set<number>();

    for (const item of items) {
      const other = pane.side === "left" ? item.right : item.left;
      if (!other || drawn.has(item.index)) {
        continue;
      }
      drawn.add(item.index);

      if (other.type === "arrow") {
        const points = absPoints(other).map(toView);
        pane.svg.append(
          svgEl("polyline", {
            points: points.map((p) => p.join(",")).join(" "),
          }),
          svgEl("circle", { cx: points[0][0], cy: points[0][1], r: 3 }),
          svgEl("circle", {
            cx: points[points.length - 1][0],
            cy: points[points.length - 1][1],
            r: 3,
          }),
        );
        const label = svgEl("text", {
          x: points[0][0] + 6,
          y: points[0][1] - 6,
        });
        label.textContent = `#${item.index} ${otherSide(
          pane.side,
        )[0].toUpperCase()}`;
        pane.svg.append(label);
      } else {
        const [x, y] = toView([other.x, other.y]);
        pane.svg.append(
          svgEl("rect", {
            x,
            y,
            width: other.width * zoom.value,
            height: other.height * zoom.value,
          }),
        );
      }
    }
  }
};

let guardTimer = 0;

/** if the panes drifted in viewport/settings, copy the leader's (when idle) */
const guardAppState = () => {
  const src = panes[leader];
  const dst = panes[otherSide(leader)];
  if (!ui.mirror.checked || pointerIsDown || !src.api || !dst.api) {
    return;
  }
  const a = src.api.getAppState();
  const b = dst.api.getAppState();
  const patch: Record<string, unknown> = {};
  if (
    Math.abs(a.scrollX - b.scrollX) > 0.01 ||
    Math.abs(a.scrollY - b.scrollY) > 0.01 ||
    Math.abs(a.zoom.value - b.zoom.value) > 1e-4
  ) {
    Object.assign(patch, {
      scrollX: a.scrollX,
      scrollY: a.scrollY,
      zoom: { value: a.zoom.value },
    });
  }
  for (const key of GUARDED_APPSTATE) {
    if (a[key] !== b[key]) {
      patch[key] = a[key];
    }
  }
  if (Object.keys(patch).length) {
    dst.api.updateScene({
      appState: dst.win!.JSON.parse(JSON.stringify(patch)),
      captureUpdate: dst.EX.CaptureUpdateAction.NEVER,
    });
    log(`guard: copied ${Object.keys(patch).join(", ")} → ${dst.side}`, "warn");
  }
};

let updateScheduled = false;

const update = () => {
  updateScheduled = false;
  const { left, right } = panes;
  if (!left.api || !right.api) {
    return;
  }
  const result = compareScenes(
    left.api.getSceneElements(),
    right.api.getSceneElements(),
  );
  renderReport(result);
  renderGhosts(result.items);
  autosave();

  window.clearTimeout(guardTimer);
  guardTimer = window.setTimeout(guardAppState, 400);
};

function scheduleUpdate() {
  if (!updateScheduled) {
    updateScheduled = true;
    requestAnimationFrame(update);
  }
}

// -----------------------------------------------------------------------------
// actions
// -----------------------------------------------------------------------------

const cloneInto = (pane: Pane, value: unknown) =>
  pane.win!.JSON.parse(JSON.stringify(value));

const bothReady = () => {
  if (!panes.left.api || !panes.right.api) {
    log("editors not ready yet", "warn");
    return false;
  }
  return true;
};

/** each pane re-routes its elbow arrows from their current bindings */
const rerouteAll = (pane: Pane) => {
  let count = 0;
  for (const el of pane.api.getSceneElements()) {
    if (el.type !== "arrow" || !el.elbowed || el.points.length < 2) {
      continue;
    }
    // endpoints only + fresh binding objects: defeats the no-op short-circuit
    // in updateElbowArrowPoints, so the arrow is routed from scratch (as when
    // a bound shape moves)
    pane.api.mutateElement(
      el,
      cloneInto(pane, {
        points: [el.points[0], el.points[el.points.length - 1]],
        ...(el.startBinding ? { startBinding: el.startBinding } : {}),
        ...(el.endBinding ? { endBinding: el.endBinding } : {}),
      }),
    );
    count++;
  }
  return count;
};

const copyScene = (from: Pane, to: Pane, reroute: boolean) => {
  if (!bothReady()) {
    return;
  }
  const { scrollX, scrollY, zoom } = from.api.getAppState();
  from.api.updateScene({
    appState: cloneInto(from, CLEAR_SELECTION),
    captureUpdate: from.EX.CaptureUpdateAction.NEVER,
  });
  to.api.updateScene({
    elements: cloneInto(to, from.api.getSceneElementsIncludingDeleted()),
    appState: cloneInto(to, { ...CLEAR_SELECTION, scrollX, scrollY, zoom }),
    captureUpdate: to.EX.CaptureUpdateAction.IMMEDIATELY,
  });
  const files = Object.values(from.api.getFiles() ?? {});
  if (files.length) {
    to.api.addFiles(cloneInto(to, files));
  }
  from.api.history.clear();
  to.api.history.clear();

  const rerouted = reroute ? rerouteAll(to) : 0;
  log(
    `copied ${from.side} → ${to.side}${
      reroute ? `, ${to.side} re-routed ${rerouted} elbow arrow(s)` : ""
    } (selection + undo history cleared in both)`,
  );
};

const clearBoth = () => {
  if (!bothReady()) {
    return;
  }
  for (const pane of Object.values(panes)) {
    pane.api.updateScene({
      elements: [],
      appState: cloneInto(pane, {
        ...CLEAR_SELECTION,
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 },
      }),
      captureUpdate: pane.EX.CaptureUpdateAction.IMMEDIATELY,
    });
    pane.api.history.clear();
  }
  log("cleared both");
};

const loadSceneText = async (text: string, name: string) => {
  if (!bothReady()) {
    return;
  }
  for (const pane of Object.values(panes)) {
    const W = pane.win!;
    const data = await pane.EX.loadFromBlob(
      new W.Blob([text], { type: "application/json" }),
      null,
      null,
    );
    pane.api.updateScene({
      elements: data.elements,
      appState: cloneInto(pane, CLEAR_SELECTION),
      captureUpdate: pane.EX.CaptureUpdateAction.IMMEDIATELY,
    });
    if (data.files) {
      pane.api.addFiles(Object.values(data.files));
    }
    pane.api.history.clear();
  }
  // same container size + same elements → same viewport
  for (const pane of Object.values(panes)) {
    pane.api.setViewport({
      target: pane.api.getSceneElements(),
      fit: "scale-down",
      animation: false,
    });
  }
  const counts = Object.values(panes).map(
    (pane) => `${pane.side} ${rerouteAll(pane)}`,
  );
  log(
    `loaded ${name} into both; re-routed elbow arrows (${counts.join(", ")})`,
  );
};

// The left scene is autosaved, so a Vite full reload (editing a non-component
// module in either tree reloads every page) doesn't lose the scenario.
const AUTOSAVE_KEY = "ab:last-scene";
let autosaveTimer = 0;

const autosave = () => {
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    const pane = panes.left;
    // never overwrite the last scenario with the empty scene after a reload
    if (!pane.api || !pane.api.getSceneElements().length) {
      return;
    }
    try {
      localStorage.setItem(
        AUTOSAVE_KEY,
        pane.EX.serializeAsJSON(
          pane.api.getSceneElementsIncludingDeleted(),
          pane.api.getAppState(),
          pane.api.getFiles(),
          "local",
        ),
      );
    } catch {
      // storage full / unavailable
    }
  }, 600);
};

const restoreAutosave = () => {
  let text: string | null = null;
  try {
    text = localStorage.getItem(AUTOSAVE_KEY);
  } catch {
    // unavailable
  }
  if (!text) {
    log("nothing autosaved yet", "warn");
    return;
  }
  loadSceneText(text, "the autosaved left scene").catch((error) =>
    log(`restore failed: ${error}`, "warn"),
  );
};

const saveScene = (pane: Pane) => {
  if (!pane.api) {
    return;
  }
  const json = pane.EX.serializeAsJSON(
    pane.api.getSceneElementsIncludingDeleted(),
    pane.api.getAppState(),
    pane.api.getFiles(),
    "local",
  );
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  link.download = `ab-${pane.side}-${stamp}.excalidraw`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};

$("#copy-lr").addEventListener("click", () =>
  copyScene(panes.left, panes.right, false),
);
$("#copy-rl").addEventListener("click", () =>
  copyScene(panes.right, panes.left, false),
);
$("#reroute-lr").addEventListener("click", () =>
  copyScene(panes.left, panes.right, true),
);
$("#reroute-rl").addEventListener("click", () =>
  copyScene(panes.right, panes.left, true),
);
$("#reroute-both").addEventListener("click", () => {
  if (bothReady()) {
    const counts = Object.values(panes).map(
      (pane) => `${pane.side} ${rerouteAll(pane)}`,
    );
    log(`re-routed elbow arrows in place (${counts.join(", ")})`);
  }
});
$("#clear").addEventListener("click", clearBoth);
$("#restore").addEventListener("click", restoreAutosave);
$("#save-left").addEventListener("click", () => saveScene(panes.left));
$("#save-right").addEventListener("click", () => saveScene(panes.right));
$("#load").addEventListener("click", () => ui.file.click());
ui.file.addEventListener("change", () => {
  const file = ui.file.files?.[0];
  ui.file.value = "";
  if (file) {
    file
      .text()
      .then((text) => loadSceneText(text, file.name))
      .catch((error) => log(`load failed: ${error}`, "warn"));
  }
});
ui.ghosts.addEventListener("change", scheduleUpdate);
ui.mirror.addEventListener("change", () =>
  log(
    ui.mirror.checked
      ? "mirroring on"
      : "mirroring off — panes act independently",
  ),
);

// -----------------------------------------------------------------------------
// boot
// -----------------------------------------------------------------------------

const describeTree = (tree: Tree) => {
  const b = document.createElement("b");
  b.textContent = tree.label;
  const parts: (string | Node)[] = [b];
  if (tree.warning) {
    const warning = document.createElement("span");
    warning.className = "tree-warning";
    warning.textContent = ` ⚠ ${tree.warning}`;
    parts.push(warning);
    log(`${tree.side}: ${tree.warning}`, "warn");
  }
  parts.push(
    ` · ${tree.sha.slice(0, 9)}${tree.dirty ? " +uncommitted" : ""}${
      tree.kind === "dir" ? " (live)" : ""
    } · ${tree.subject}`,
  );
  return parts;
};

fetch("/__ab/trees")
  .then((res) => res.json())
  .then((trees: Record<Side, Tree>) => {
    for (const pane of Object.values(panes)) {
      const tree = trees[pane.side];
      pane.label.replaceChildren(...describeTree(tree));
      pane.label.title = `${tree.root}\n${tree.sha}\n${tree.subject}`;
    }
    document.title = `A/B: ${trees.left.label} vs ${trees.right.label}`;
  })
  .catch(() => {});

for (const pane of Object.values(panes)) {
  pane.iframe.addEventListener("load", () => {
    attach(pane).catch((error) =>
      log(`${pane.side}: attach failed: ${error}`, "warn"),
    );
  });
  // set src only after the load listener is in place
  pane.iframe.src = `./${pane.side}/`;
}
setLeader("left");

// for poking around from the console
Object.assign(window, { ab: { panes, rerouteAll, copyScene, compareScenes } });
