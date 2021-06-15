import "./jsdom";
import { Handler, HandlerResponse } from "@netlify/functions";
import { renderScene, renderSceneToSvg } from "../../src/renderer/renderScene";
import jsonUrlMakeCodec from "json-url";
import { ImportedDataState } from "../../src/data/types";
import { NonDeletedExcalidrawElement } from "../../src/element/types";
import rough from "roughjs";
import { defaultAppState, defaultSceneState } from "./defaults";
import { registerFont } from "canvas";
import { getExportSize } from "../../src/scene/export";
import { DEFAULT_EXPORT_PADDING } from "../../src/constants";
import { getCommonBounds } from "../../src/element";

const codec = jsonUrlMakeCodec("lzma");

registerFont("./public/Cascadia.ttf", { family: "Cascadia" });
registerFont("./public/FG_Virgil.ttf", { family: "Virgil" });

const DEFAULT_SCALE = 1;

const blobToBytes = async (blob: Blob): Promise<Buffer> => {
  const reader = new window.FileReader();
  const done: Promise<string | ArrayBuffer> = new Promise((res) =>
    reader.addEventListener("loadend", () => res(reader.result)),
  );
  reader.readAsArrayBuffer(blob);
  const buf = await done;
  if (typeof buf == "string") {
    throw new Error("Invalid blob type");
  }
  return Buffer.from(buf);
};

export const handler: Handler = async (event): Promise<HandlerResponse> => {
  const { s: compressed } = event.queryStringParameters;
  if (!compressed) {
    return {
      statusCode: 400,
      body: "Expected s parameter with compressed image data",
    };
  }

  const { elements }: ImportedDataState = await codec.decompress(compressed);
  if (!elements) {
    return {
      statusCode: 400,
      body: "Missing elements from serialized image",
    };
  }

  const nonDeletedElements = elements.filter(
    (e) => !e.isDeleted,
  ) as NonDeletedExcalidrawElement[];

  const [minX, minY] = getCommonBounds(nonDeletedElements);
  const [width, height] = getExportSize(
    nonDeletedElements,
    DEFAULT_EXPORT_PADDING,
    DEFAULT_SCALE,
  );

  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  canvas.width = width;
  canvas.height = height;

  const rc = rough.canvas(canvas);
  // const svg = (document.createElement("svg") as unknown) as SVGSVGElement;
  // const roughSVG = rough.svg(svg);
  renderScene(
    nonDeletedElements,
    defaultAppState,
    null,
    DEFAULT_SCALE,
    rc,
    canvas,
    {
      viewBackgroundColor: null,
      exportWithDarkMode: false,
      scrollX: -minX + DEFAULT_EXPORT_PADDING,
      scrollY: -minY + DEFAULT_EXPORT_PADDING,
      zoom: defaultAppState.zoom,
      remotePointerViewportCoords: {},
      remoteSelectedElementIds: {},
      shouldCacheIgnoreZoom: false,
      remotePointerUsernames: {},
      remotePointerUserStates: {},
    },
    {
      renderScrollbars: false,
      renderSelection: false,
      renderOptimizations: false,
      renderGrid: false,
    },
  );
  //const svgText = svg.innerHTML;
  //console.log({ svgText });

  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res));
  if (!blob) {
    return { statusCode: 500 };
  }

  const buf = await blobToBytes(blob);

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "image/png",
    },
    isBase64Encoded: true,
    body: buf.toString("base64"),
  };
};
