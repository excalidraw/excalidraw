import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  hashElementsVersion,
  hashString,
  newElementWith,
} from "@excalidraw/excalidraw";

import { fixBindingsAfterDeletion } from "@excalidraw/element";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import type { WebMcpExecutionOptions } from "./modelContext";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_BATCH_SIZE = 100;
const ARROWHEADS = new Set([null, "arrow", "bar", "dot", "triangle"]);
const SUPPORTED_TYPES = new Set([
  "rectangle",
  "ellipse",
  "diamond",
  "line",
  "arrow",
  "text",
]);
const ADDABLE_PROPERTIES = new Set([
  "id",
  "type",
  "x",
  "y",
  "width",
  "height",
  "text",
  "fontSize",
  "points",
  "startArrowhead",
  "endArrowhead",
  "label",
  "strokeColor",
  "backgroundColor",
  "fillStyle",
  "strokeWidth",
  "strokeStyle",
  "roughness",
  "opacity",
]);
const EDITABLE_PROPERTIES = new Set([
  "x",
  "y",
  "width",
  "height",
  "text",
  "fontSize",
  "strokeColor",
  "backgroundColor",
  "fillStyle",
  "strokeWidth",
  "strokeStyle",
  "roughness",
  "opacity",
]);
const LABEL_PROPERTIES = new Set(["text", "fontSize"]);
const PATCH_PROPERTIES = new Set(["id", "changes"]);
const READ_INPUT_PROPERTIES = new Set(["limit", "cursor"]);
const ADD_INPUT_PROPERTIES = new Set(["expected_revision", "elements"]);
const UPDATE_INPUT_PROPERTIES = new Set(["expected_revision", "patches"]);
const DELETE_INPUT_PROPERTIES = new Set(["expected_revision", "ids"]);
const FIT_INPUT_PROPERTIES = new Set(["scope", "animate"]);

type ToolFailure = {
  ok: false;
  code:
    | "CANCELED"
    | "INVALID_INPUT"
    | "NOT_FOUND"
    | "STALE_REVISION"
    | "UNAVAILABLE";
  message: string;
  current_revision?: string;
};

/** 将未知输入收窄为普通对象。 */
const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** 返回对象中首个不允许出现的字段。 */
const findUnknownProperty = (
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
) => Object.keys(value).find((property) => !allowed.has(property));

/** 创建结构化工具错误，便于调用方决定是否重试。 */
const failure = (
  code: ToolFailure["code"],
  message: string,
  currentRevision?: string,
): ToolFailure => ({
  ok: false,
  code,
  message,
  ...(currentRevision ? { current_revision: currentRevision } : null),
});

/** 校验工具调用的顶层字段与编辑器可用状态。 */
const validateCall = (
  api: ExcalidrawImperativeAPI,
  input: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): ToolFailure | null => {
  if (api.isDestroyed) {
    return failure("UNAVAILABLE", "The Excalidraw canvas is not available.");
  }
  const unknownProperty = findUnknownProperty(input, allowed);
  return unknownProperty
    ? failure("INVALID_INPUT", `Unknown input property: ${unknownProperty}`)
    : null;
};

/** 计算包含删除墓碑与选择状态的画布修订号。 */
export const getCanvasRevision = (api: ExcalidrawImperativeAPI): string => {
  const elementVersion = hashElementsVersion(
    api.getSceneElementsIncludingDeleted(),
  );
  const selectedIds = Object.keys(api.getAppState().selectedElementIds)
    .filter((id) => api.getAppState().selectedElementIds[id])
    .sort()
    .join(",");
  return `r${hashString(`${elementVersion}|${selectedIds}`)}`;
};

/** 只暴露模型操作所需的紧凑元素字段。 */
const projectElement = (element: ExcalidrawElement) => {
  const projected: Record<string, unknown> = {
    id: element.id,
    type: element.type,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    angle: element.angle,
    strokeColor: element.strokeColor,
    backgroundColor: element.backgroundColor,
    fillStyle: element.fillStyle,
    strokeWidth: element.strokeWidth,
    strokeStyle: element.strokeStyle,
    roughness: element.roughness,
    opacity: element.opacity,
  };

  if (element.type === "text") {
    projected.text = element.text;
    projected.fontSize = element.fontSize;
  }
  if (element.type === "line" || element.type === "arrow") {
    projected.points = element.points;
    projected.startArrowhead = element.startArrowhead;
    projected.endArrowhead = element.endArrowhead;
  }
  return projected;
};

/** 检查调用是否已被宿主取消。 */
const canceled = (options?: WebMcpExecutionOptions): ToolFailure | null =>
  options?.signal.aborted
    ? failure("CANCELED", "The tool call was canceled.")
    : null;

/** 解析与当前修订号绑定的分页游标。 */
const parseCursor = (
  cursor: unknown,
  revision: string,
): number | ToolFailure => {
  if (cursor === undefined) {
    return 0;
  }
  if (typeof cursor !== "string") {
    return failure("INVALID_INPUT", "cursor must be a string.");
  }
  const separator = cursor.lastIndexOf(":");
  const cursorRevision = cursor.slice(0, separator);
  const offset = Number(cursor.slice(separator + 1));
  if (separator < 1 || !Number.isSafeInteger(offset) || offset < 0) {
    return failure("INVALID_INPUT", "cursor is invalid.");
  }
  if (cursorRevision !== revision) {
    return failure(
      "STALE_REVISION",
      "The canvas changed while reading pages.",
      revision,
    );
  }
  return offset;
};

/** 读取当前画布的紧凑分页快照。 */
export const readCanvas = (
  api: ExcalidrawImperativeAPI,
  input: Record<string, unknown>,
  options?: WebMcpExecutionOptions,
) => {
  const canceledResult = canceled(options);
  if (canceledResult) {
    return canceledResult;
  }
  const invalidCall = validateCall(api, input, READ_INPUT_PROPERTIES);
  if (invalidCall) {
    return invalidCall;
  }
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  if (
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_PAGE_SIZE
  ) {
    return failure(
      "INVALID_INPUT",
      `limit must be between 1 and ${MAX_PAGE_SIZE}.`,
    );
  }

  const revision = getCanvasRevision(api);
  const offset = parseCursor(input.cursor, revision);
  if (typeof offset !== "number") {
    return offset;
  }
  const elements = api.getSceneElements();
  if (offset > elements.length) {
    return failure("INVALID_INPUT", "cursor is past the end of the canvas.");
  }
  const page = elements.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  const liveIds = new Set(elements.map((element) => element.id));
  const selectedIds = Object.keys(api.getAppState().selectedElementIds).filter(
    (id) => api.getAppState().selectedElementIds[id] && liveIds.has(id),
  );

  return {
    ok: true,
    revision,
    element_count: elements.length,
    selected_ids: selectedIds,
    elements: page.map(projectElement),
    truncated: nextOffset < elements.length,
    ...(nextOffset < elements.length
      ? { next_cursor: `${revision}:${nextOffset}` }
      : null),
  };
};

/** 在任何写入前验证取消状态与乐观并发修订号。 */
const validateMutation = (
  api: ExcalidrawImperativeAPI,
  input: Record<string, unknown>,
  options?: WebMcpExecutionOptions,
): string | ToolFailure => {
  const canceledResult = canceled(options);
  if (canceledResult) {
    return canceledResult;
  }
  if (typeof input.expected_revision !== "string") {
    return failure("INVALID_INPUT", "expected_revision is required.");
  }
  const revision = getCanvasRevision(api);
  if (input.expected_revision !== revision) {
    return failure(
      "STALE_REVISION",
      "The canvas changed since it was read.",
      revision,
    );
  }
  return revision;
};

/** 判断返回值是否为结构化工具错误。 */
const isFailure = (value: string | ToolFailure): value is ToolFailure =>
  typeof value !== "string";

/** 判断数值是否有限且落在允许区间。 */
const isBoundedNumber = (value: unknown, minimum: number, maximum: number) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= minimum &&
  value <= maximum;

/** 校验代理可写入的通用样式字段。 */
const hasValidStyles = (element: Record<string, unknown>) =>
  (element.strokeColor === undefined ||
    (typeof element.strokeColor === "string" &&
      element.strokeColor.length > 0 &&
      element.strokeColor.length <= 64)) &&
  (element.backgroundColor === undefined ||
    (typeof element.backgroundColor === "string" &&
      element.backgroundColor.length > 0 &&
      element.backgroundColor.length <= 64)) &&
  (element.fillStyle === undefined ||
    ["hachure", "cross-hatch", "solid", "zigzag"].includes(
      element.fillStyle as string,
    )) &&
  (element.strokeStyle === undefined ||
    ["solid", "dashed", "dotted"].includes(element.strokeStyle as string)) &&
  (element.strokeWidth === undefined ||
    isBoundedNumber(element.strokeWidth, 0.5, 20)) &&
  (element.roughness === undefined ||
    isBoundedNumber(element.roughness, 0, 2)) &&
  (element.opacity === undefined || isBoundedNumber(element.opacity, 0, 100));

/** 校验线性元素的点列表。 */
const hasValidPoints = (points: unknown) =>
  Array.isArray(points) &&
  points.length >= 2 &&
  points.length <= 1_000 &&
  points.every(
    (point) =>
      Array.isArray(point) &&
      point.length === 2 &&
      point.every((coordinate) =>
        isBoundedNumber(coordinate, -1_000_000, 1_000_000),
      ),
  );

/** 校验可选的容器标签，拒绝透传未知字段。 */
const hasValidLabel = (label: unknown) => {
  if (label === undefined) {
    return true;
  }
  const value = asRecord(label);
  return Boolean(
    value &&
      !findUnknownProperty(value, LABEL_PROPERTIES) &&
      typeof value.text === "string" &&
      value.text.length <= 10_000 &&
      (value.fontSize === undefined || isBoundedNumber(value.fontSize, 1, 512)),
  );
};

/** 校验新增元素的最小结构和安全类型集合。 */
const validateSkeletons = (
  value: unknown,
): ExcalidrawElementSkeleton[] | ToolFailure => {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > MAX_BATCH_SIZE
  ) {
    return failure(
      "INVALID_INPUT",
      `elements must contain between 1 and ${MAX_BATCH_SIZE} items.`,
    );
  }
  for (const candidate of value) {
    const element = asRecord(candidate);
    const unsupportedProperty = element
      ? findUnknownProperty(element, ADDABLE_PROPERTIES)
      : undefined;
    if (
      !element ||
      unsupportedProperty ||
      typeof element.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(element.id) ||
      typeof element.type !== "string" ||
      !SUPPORTED_TYPES.has(element.type) ||
      !isBoundedNumber(element.x, -1_000_000, 1_000_000) ||
      !isBoundedNumber(element.y, -1_000_000, 1_000_000) ||
      !hasValidStyles(element) ||
      !hasValidLabel(element.label)
    ) {
      return failure(
        "INVALID_INPUT",
        unsupportedProperty
          ? `Property cannot be added: ${unsupportedProperty}`
          : "Each element must have a valid id, supported type, x, y, and styles.",
      );
    }
    if (
      element.type === "text" &&
      (typeof element.text !== "string" ||
        element.text.length > 10_000 ||
        (element.fontSize !== undefined &&
          !isBoundedNumber(element.fontSize, 1, 512)) ||
        element.width !== undefined ||
        element.height !== undefined ||
        element.points !== undefined ||
        element.label !== undefined ||
        element.startArrowhead !== undefined ||
        element.endArrowhead !== undefined)
    ) {
      return failure("INVALID_INPUT", "Text elements require bounded text.");
    }
    if (
      element.type !== "text" &&
      element.type !== "line" &&
      element.type !== "arrow" &&
      (!isBoundedNumber(element.width, Number.EPSILON, 100_000) ||
        !isBoundedNumber(element.height, Number.EPSILON, 100_000))
    ) {
      return failure(
        "INVALID_INPUT",
        "Shape elements require positive width and height.",
      );
    }
    if (
      (element.type === "line" || element.type === "arrow") &&
      (!hasValidPoints(element.points) ||
        element.width !== undefined ||
        element.height !== undefined ||
        element.text !== undefined ||
        element.fontSize !== undefined ||
        (element.label !== undefined && element.type !== "arrow") ||
        (element.startArrowhead !== undefined &&
          !ARROWHEADS.has(element.startArrowhead as string | null)) ||
        (element.endArrowhead !== undefined &&
          !ARROWHEADS.has(element.endArrowhead as string | null)))
    ) {
      return failure(
        "INVALID_INPUT",
        "Line and arrow elements require at least two valid points.",
      );
    }
    if (
      element.type !== "text" &&
      element.type !== "line" &&
      element.type !== "arrow" &&
      (element.text !== undefined ||
        element.fontSize !== undefined ||
        element.points !== undefined ||
        element.startArrowhead !== undefined ||
        element.endArrowhead !== undefined)
    ) {
      return failure(
        "INVALID_INPUT",
        "Shape elements contain properties that do not apply to their type.",
      );
    }
  }
  return value as ExcalidrawElementSkeleton[];
};

/** 将完整场景作为一个立即可撤销的历史步骤提交。 */
const commitElements = (
  api: ExcalidrawImperativeAPI,
  elements: readonly ExcalidrawElement[],
  appState?: Pick<AppState, "selectedElementIds">,
) => {
  api.updateScene({
    elements,
    ...(appState ? { appState } : null),
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
};

/** 新增一批元素并返回写入后的修订号。 */
export const addElements = (
  api: ExcalidrawImperativeAPI,
  input: Record<string, unknown>,
  options?: WebMcpExecutionOptions,
) => {
  const invalidCall = validateCall(api, input, ADD_INPUT_PROPERTIES);
  if (invalidCall) {
    return invalidCall;
  }
  const revision = validateMutation(api, input, options);
  if (isFailure(revision)) {
    return revision;
  }
  const skeletons = validateSkeletons(input.elements);
  if (!Array.isArray(skeletons)) {
    return skeletons;
  }
  const existingIds = new Set(
    api.getSceneElementsIncludingDeleted().map((element) => element.id),
  );
  const requestedIds = new Set<string>();
  for (const skeleton of skeletons) {
    if (
      skeleton.id &&
      (existingIds.has(skeleton.id) || requestedIds.has(skeleton.id))
    ) {
      return failure(
        "INVALID_INPUT",
        `Element id already exists: ${skeleton.id}`,
      );
    }
    if (skeleton.id) {
      requestedIds.add(skeleton.id);
    }
  }

  const created = convertToExcalidrawElements(skeletons, {
    regenerateIds: false,
  });
  commitElements(api, [...api.getSceneElementsIncludingDeleted(), ...created]);
  return {
    ok: true,
    affected_ids: created.map((element) => element.id),
    revision: getCanvasRevision(api),
  };
};

/** 校验补丁只修改允许的用户可编辑属性。 */
const validateChanges = (
  element: ExcalidrawElement,
  value: unknown,
): Record<string, unknown> | ToolFailure => {
  const changes = asRecord(value);
  if (!changes || Object.keys(changes).length === 0) {
    return failure(
      "INVALID_INPUT",
      "changes must contain at least one property.",
    );
  }
  const unsafe = Object.keys(changes).find(
    (property) => !EDITABLE_PROPERTIES.has(property),
  );
  if (unsafe) {
    return failure("INVALID_INPUT", `Property cannot be updated: ${unsafe}`);
  }
  if (
    (changes.x !== undefined &&
      !isBoundedNumber(changes.x, -1_000_000, 1_000_000)) ||
    (changes.y !== undefined &&
      !isBoundedNumber(changes.y, -1_000_000, 1_000_000)) ||
    (changes.width !== undefined &&
      !isBoundedNumber(changes.width, Number.EPSILON, 100_000)) ||
    (changes.height !== undefined &&
      !isBoundedNumber(changes.height, Number.EPSILON, 100_000)) ||
    (changes.text !== undefined &&
      (typeof changes.text !== "string" || changes.text.length > 10_000)) ||
    (changes.fontSize !== undefined &&
      !isBoundedNumber(changes.fontSize, 1, 512)) ||
    !hasValidStyles(changes)
  ) {
    return failure("INVALID_INPUT", "changes contain an invalid value.");
  }
  if (
    ("width" in changes || "height" in changes) &&
    (element.type === "text" ||
      element.type === "line" ||
      element.type === "arrow")
  ) {
    return failure(
      "INVALID_INPUT",
      "width and height cannot directly update text or linear elements.",
    );
  }
  return changes;
};

/** 为文本更新重新计算由字体和内容决定的尺寸。 */
const normalizeTextChanges = (
  element: ExcalidrawElement,
  changes: Record<string, unknown>,
): Record<string, unknown> | ToolFailure => {
  if (!("text" in changes || "fontSize" in changes)) {
    return changes;
  }
  if (element.type !== "text") {
    return failure(
      "INVALID_INPUT",
      "text and fontSize can only update text elements.",
    );
  }
  const converted = convertToExcalidrawElements(
    [
      {
        type: "text",
        x: (changes.x as number | undefined) ?? element.x,
        y: (changes.y as number | undefined) ?? element.y,
        text: (changes.text as string | undefined) ?? element.text,
        fontSize: (changes.fontSize as number | undefined) ?? element.fontSize,
        fontFamily: element.fontFamily,
        textAlign: element.textAlign,
      },
    ],
    { regenerateIds: true },
  )[0];
  return {
    ...changes,
    width: converted.width,
    height: converted.height,
  };
};

/** 更新一批元素，并把整批操作记录为单个历史步骤。 */
export const updateElements = (
  api: ExcalidrawImperativeAPI,
  input: Record<string, unknown>,
  options?: WebMcpExecutionOptions,
) => {
  const invalidCall = validateCall(api, input, UPDATE_INPUT_PROPERTIES);
  if (invalidCall) {
    return invalidCall;
  }
  const revision = validateMutation(api, input, options);
  if (isFailure(revision)) {
    return revision;
  }
  if (
    !Array.isArray(input.patches) ||
    input.patches.length < 1 ||
    input.patches.length > MAX_BATCH_SIZE
  ) {
    return failure(
      "INVALID_INPUT",
      `patches must contain between 1 and ${MAX_BATCH_SIZE} items.`,
    );
  }

  const elements = api.getSceneElementsIncludingDeleted();
  const elementMap = new Map(elements.map((element) => [element.id, element]));
  const changesById = new Map<string, Record<string, unknown>>();
  for (const candidate of input.patches) {
    const patch = asRecord(candidate);
    if (
      !patch ||
      findUnknownProperty(patch, PATCH_PROPERTIES) ||
      typeof patch.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(patch.id)
    ) {
      return failure("INVALID_INPUT", "Each patch requires an id and changes.");
    }
    const element = elementMap.get(patch.id);
    if (!element || element.isDeleted) {
      return failure("NOT_FOUND", `Element not found: ${patch.id}`);
    }
    if (changesById.has(patch.id)) {
      return failure("INVALID_INPUT", `Duplicate patch id: ${patch.id}`);
    }
    const changes = validateChanges(element, patch.changes);
    if ("ok" in changes) {
      return changes;
    }
    const normalized = normalizeTextChanges(element, changes);
    if ("ok" in normalized) {
      return normalized;
    }
    changesById.set(patch.id, normalized);
  }

  const nextElements = elements.map((element) => {
    const changes = changesById.get(element.id);
    return changes ? newElementWith(element, changes) : element;
  });
  commitElements(api, nextElements);
  return {
    ok: true,
    affected_ids: [...changesById.keys()],
    revision: getCanvasRevision(api),
  };
};

/** 删除元素及其绑定文本，并修复其他元素上遗留的绑定。 */
export const deleteElements = (
  api: ExcalidrawImperativeAPI,
  input: Record<string, unknown>,
  options?: WebMcpExecutionOptions,
) => {
  const invalidCall = validateCall(api, input, DELETE_INPUT_PROPERTIES);
  if (invalidCall) {
    return invalidCall;
  }
  const revision = validateMutation(api, input, options);
  if (isFailure(revision)) {
    return revision;
  }
  if (
    !Array.isArray(input.ids) ||
    input.ids.length < 1 ||
    input.ids.length > MAX_BATCH_SIZE ||
    input.ids.some(
      (id) => typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id),
    ) ||
    new Set(input.ids).size !== input.ids.length
  ) {
    return failure(
      "INVALID_INPUT",
      `ids must contain between 1 and ${MAX_BATCH_SIZE} strings.`,
    );
  }
  const elements = api.getSceneElementsIncludingDeleted();
  const elementMap = new Map(elements.map((element) => [element.id, element]));
  const idsToDelete = new Set(input.ids as string[]);
  for (const id of idsToDelete) {
    const element = elementMap.get(id);
    if (!element || element.isDeleted) {
      return failure("NOT_FOUND", `Element not found: ${id}`);
    }
    element.boundElements
      ?.filter((binding) => binding.type === "text")
      .forEach((binding) => idsToDelete.add(binding.id));
  }

  // 绑定修复会原地修改受影响元素，因此先与实时场景隔离。
  const mutableElements = elements.map((element) => ({
    ...element,
  })) as ExcalidrawElement[];
  const deleted: ExcalidrawElement[] = [];
  const nextElements = mutableElements.map((element) => {
    if (idsToDelete.has(element.id) && !element.isDeleted) {
      const next = newElementWith(element, { isDeleted: true });
      deleted.push(next);
      return next;
    }
    if (element.frameId && idsToDelete.has(element.frameId)) {
      return newElementWith(element, { frameId: null });
    }
    return element;
  });
  fixBindingsAfterDeletion(nextElements, deleted);
  const selectedElementIds = Object.fromEntries(
    Object.entries(api.getAppState().selectedElementIds).filter(
      ([id, selected]) => selected && !idsToDelete.has(id),
    ),
  );
  commitElements(api, nextElements, { selectedElementIds });
  return {
    ok: true,
    affected_ids: deleted.map((element) => element.id),
    revision: getCanvasRevision(api),
  };
};

/** 将视口适配到全部元素或当前选择，不产生撤销历史。 */
export const fitToContent = (
  api: ExcalidrawImperativeAPI,
  input: Record<string, unknown>,
  options?: WebMcpExecutionOptions,
) => {
  const canceledResult = canceled(options);
  if (canceledResult) {
    return canceledResult;
  }
  const invalidCall = validateCall(api, input, FIT_INPUT_PROPERTIES);
  if (invalidCall) {
    return invalidCall;
  }
  const scope = input.scope ?? "all";
  if (scope !== "all" && scope !== "selection") {
    return failure("INVALID_INPUT", "scope must be all or selection.");
  }
  if (input.animate !== undefined && typeof input.animate !== "boolean") {
    return failure("INVALID_INPUT", "animate must be a boolean.");
  }
  const elements = api.getSceneElements();
  const selectedIds = api.getAppState().selectedElementIds;
  const target =
    scope === "selection"
      ? elements.filter((element) => selectedIds[element.id])
      : elements;
  if (target.length === 0) {
    return failure(
      "NOT_FOUND",
      `No ${scope === "selection" ? "selected" : "visible"} elements to fit.`,
    );
  }
  api.setViewport({
    target,
    fit: "contain",
    animation: input.animate ?? true,
    offsets: { ui: true },
  });
  return {
    ok: true,
    focused_ids: target.map((element) => element.id),
    revision: getCanvasRevision(api),
  };
};
