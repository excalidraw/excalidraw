import { Keyboard } from "@excalidraw/excalidraw/tests/helpers/ui";
import { act, render, waitFor } from "@excalidraw/excalidraw/tests/test-utils";
import { vi } from "vitest";

import ExcalidrawApp from "../App";

type RegisteredTool = {
  name: string;
  execute: (input: Record<string, unknown>) => unknown | Promise<unknown>;
};

type RegistrationOptions = {
  signal?: AbortSignal;
};

type ModelContextStub = {
  registerTool: (
    tool: RegisteredTool,
    options?: RegistrationOptions,
  ) => Promise<void>;
};

vi.mock("../../excalidraw-app/data/firebase.ts", () => ({
  loadFromFirebase: async () => null,
  saveToFirebase: () => {},
  isSavedToFirebase: () => true,
  loadFilesFromFirebase: async () => ({
    loadedFiles: [],
    erroredFiles: [],
  }),
  saveFilesToFirebase: async () => ({
    savedFiles: new Map(),
    erroredFiles: new Map(),
  }),
}));

vi.mock("socket.io-client", () => ({
  default: () => ({
    close: () => {},
    on: () => {},
    once: () => {},
    off: () => {},
    emit: () => {},
  }),
}));

describe("Excalidraw WebMCP tools", () => {
  afterEach(() => {
    Reflect.deleteProperty(document, "modelContext");
  });

  it("registers the five canvas tools and unregisters them on unmount", async () => {
    const registrations: Array<{
      tool: RegisteredTool;
      signal?: AbortSignal;
    }> = [];
    const modelContext: ModelContextStub = {
      registerTool: vi.fn(async (tool, options) => {
        registrations.push({ tool, signal: options?.signal });
      }),
    };
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: modelContext,
    });

    const rendered = await render(<ExcalidrawApp />);

    await waitFor(() => {
      expect(registrations.map(({ tool }) => tool.name)).toEqual([
        "read_canvas",
        "add_elements",
        "update_elements",
        "delete_elements",
        "fit_to_content",
      ]);
    });
    expect(registrations.every(({ signal }) => signal?.aborted === false)).toBe(
      true,
    );

    rendered.unmount();

    expect(registrations.every(({ signal }) => signal?.aborted === true)).toBe(
      true,
    );
  });

  it("keeps WebMCP additions in the editor undo and redo history", async () => {
    const registrations = new Map<string, RegisteredTool>();
    const modelContext: ModelContextStub = {
      registerTool: vi.fn(async (tool) => {
        registrations.set(tool.name, tool);
      }),
    };
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: modelContext,
    });

    await render(<ExcalidrawApp />);
    await waitFor(() => expect(registrations.size).toBe(5));

    const readCanvas = registrations.get("read_canvas")!;
    const addElements = registrations.get("add_elements")!;
    const read = (await readCanvas.execute({})) as { revision: string };

    await act(async () => {
      await addElements.execute({
        expected_revision: read.revision,
        elements: [
          {
            id: "webmcp-undo",
            type: "rectangle",
            x: 100,
            y: 100,
            width: 160,
            height: 90,
          },
        ],
      });
    });
    expect(
      window.h.elements.find(({ id }) => id === "webmcp-undo")?.isDeleted,
    ).toBe(false);

    Keyboard.undo();
    await waitFor(() => {
      expect(
        window.h.elements.find(({ id }) => id === "webmcp-undo")?.isDeleted,
      ).toBe(true);
    });

    Keyboard.redo();
    await waitFor(() => {
      expect(
        window.h.elements.find(({ id }) => id === "webmcp-undo")?.isDeleted,
      ).toBe(false);
    });
  });
});
