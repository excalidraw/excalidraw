import React from "react";
import { vi } from "vitest";

import { MIME_TYPES } from "@excalidraw/common";

import type { RenderEnvironment } from "@excalidraw/element";
import type { FileId } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { render, waitFor } from "./test-utils";

import type { DataURL } from "../types";

const makeEnv = (): RenderEnvironment => ({
  createCanvas: () => document.createElement("canvas"),
  createImage: () => new Image(),
});

describe("renderEnvironment prop", () => {
  it("is forwarded to the editor, which renders through it", async () => {
    const created: HTMLCanvasElement[] = [];
    const env: RenderEnvironment = {
      createCanvas: () => {
        const canvas = document.createElement("canvas");
        created.push(canvas);
        return canvas;
      },
      createImage: () => new Image(),
    };

    // an element on the scene: element canvases are what the renderer
    // creates through the env
    await render(
      <Excalidraw
        renderEnvironment={env}
        initialData={{
          elements: [
            API.createElement({ type: "rectangle", width: 100, height: 100 }),
          ],
        }}
      />,
    );

    expect(created.length).toBeGreaterThan(0);
  });

  it("decodes scene images through the env's createImage", async () => {
    const images: any[] = [];
    const createImage = () => {
      const fake: any = {
        naturalWidth: 100,
        naturalHeight: 100,
        onload: null,
        onerror: null,
      };
      Object.defineProperty(fake, "src", {
        set(value: string) {
          fake._src = value;
          queueMicrotask(() => fake.onload?.());
        },
      });
      images.push(fake);
      return fake as HTMLImageElement;
    };

    await render(
      <Excalidraw
        renderEnvironment={{
          createCanvas: () => document.createElement("canvas"),
          createImage,
        }}
        initialData={{
          elements: [
            API.createElement({
              type: "image",
              width: 100,
              height: 100,
              fileId: "img-1" as FileId,
              status: "saved",
            }),
          ],
          files: {
            "img-1": {
              id: "img-1" as FileId,
              dataURL: "data:image/png;base64,iVBORw0KGgo=" as DataURL,
              mimeType: MIME_TYPES.png,
              created: Date.now(),
            },
          },
        }}
      />,
    );

    await waitFor(() => expect(images.length).toBeGreaterThan(0));
    expect(images[0]._src).toBe("data:image/png;base64,iVBORw0KGgo=");
  });
});

describe("renderEnvironment prop stability", () => {
  it("warns when the prop identity changes but the implementation doesn't", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { rerender } = await render(
      <Excalidraw renderEnvironment={makeEnv()} />,
    );
    expect(warn).not.toHaveBeenCalled();

    // what an inline `renderEnvironment={{ ... }}` literal does every render
    rerender(<Excalidraw renderEnvironment={makeEnv()} />);
    const warnings = warn.mock.calls.filter(([msg]) =>
      String(msg).includes("renderEnvironment"),
    );
    expect(warnings).toHaveLength(1);

    // warns once, not on every subsequent render
    rerender(<Excalidraw renderEnvironment={makeEnv()} />);
    expect(
      warn.mock.calls.filter(([msg]) =>
        String(msg).includes("renderEnvironment"),
      ),
    ).toHaveLength(1);

    warn.mockRestore();
  });

  it("doesn't warn for a stable env, nor for a genuine env swap", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = makeEnv();

    const { rerender } = await render(<Excalidraw renderEnvironment={env} />);
    rerender(<Excalidraw renderEnvironment={env} />);

    // a different implementation is an intentional switch, not a lost memo
    const otherEnv: RenderEnvironment = {
      createCanvas: () => document.createElement("canvas"),
      createImage: () => new Image(1, 1),
    };
    rerender(<Excalidraw renderEnvironment={otherEnv} />);

    expect(
      warn.mock.calls.filter(([msg]) =>
        String(msg).includes("renderEnvironment"),
      ),
    ).toHaveLength(0);

    warn.mockRestore();
  });
});
