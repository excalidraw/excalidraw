import { arrayToMap } from "@excalidraw/common";
import { pointFrom } from "@excalidraw/math";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { updateElbowArrowRoute } from "@excalidraw/element";
import type { LocalPoint } from "@excalidraw/math";
import type { ExcalidrawElbowArrowElement, NonDeletedSceneElementsMap } from "../src/types";
const C = { x: 2158.24, y: -869.92 };
const run = (ox: number, oy: number, cx = C.x) => {
  const up = API.createElement({ type: "diamond", x: cx, y: C.y, width: 226.95, height: 248.6 });
  const lo = API.createElement({ type: "diamond", x: ox, y: oy, width: 226.95, height: 248.6 });
  const arrow = API.createElement({ type: "arrow", elbowed: true, x: 0, y: 0,
    points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(1, 1)],
    startBinding: { elementId: lo.id, fixedPoint: [0.5023, 0.0073], mode: "orbit" },
    endBinding: { elementId: up.id, fixedPoint: [0.995, 0.5028], mode: "orbit" }, endArrowhead: "arrow",
  }) as unknown as ExcalidrawElbowArrowElement;
  const r = updateElbowArrowRoute(arrow, arrayToMap([lo, up]) as NonDeletedSceneElementsMap);
  const p = r.points!.map(([x, y]) => [Math.round(x + r.x!), Math.round(y + r.y!)]);
  return `legs=${JSON.stringify(p.slice(1).map((s, i) => Math.round(Math.abs(s[0] - p[i][0]) + Math.abs(s[1] - p[i][1]))))}`;
};
it("scenes", () => {
  console.log("U    ", run(2290.31, -706.24, 2158.34));
  console.log("S1   ", run(2074.24, -673.58));
  console.log("S2   ", run(2072.06, -665.19));
  console.log("S3   ", run(2071.38, -621.67));
});
