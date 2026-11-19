import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";

import { SheetManager } from "../components/SheetManager";
import {
  getSheetsIndex,
  saveSheetsIndex,
  saveSheetData,
} from "../data/sheetStorage";

const createMockExcalidrawAPI = (): any => {
  let elements: any[] = [];
  let appState: any = { theme: "light" };
  return {
    getSceneElements: vi.fn(() => elements),
    getSceneElementsIncludingDeleted: vi.fn(() => elements),
    getAppState: vi.fn(() => appState),
    updateScene: vi.fn((opts: any) => {
      if (opts.elements) {
        elements = opts.elements;
      }
      if (opts.appState) {
        appState = { ...appState, ...opts.appState };
      }
    }),
    resetScene: vi.fn(() => {
      elements = [];
      appState = { theme: appState.theme };
    }),
    addFiles: vi.fn(),
    history: {
      clear: vi.fn(),
    },
  };
};

describe("SheetManager Component", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders with initial Sheet 1 active", async () => {
    const api = createMockExcalidrawAPI();

    render(<SheetManager excalidrawAPI={api} />);

    await waitFor(() => {
      expect(screen.getByText("Sheet 1")).toBeInTheDocument();
    });

    const tab = screen.getByText("Sheet 1").closest(".sheet-tab");
    expect(tab).toHaveClass("sheet-tab--active");
  });

  it("creates a new sheet when + button is clicked", async () => {
    const api = createMockExcalidrawAPI();

    render(<SheetManager excalidrawAPI={api} />);

    await waitFor(() => {
      expect(screen.getByText("Sheet 1")).toBeInTheDocument();
    });

    const addBtn = screen.getByTitle("New sheet");
    await act(async () => {
      fireEvent.click(addBtn);
    });

    await waitFor(() => {
      expect(screen.getByText("Sheet 2")).toBeInTheDocument();
    });

    expect(api.resetScene).toHaveBeenCalled();
    const sheet2Tab = screen.getByText("Sheet 2").closest(".sheet-tab");
    expect(sheet2Tab).toHaveClass("sheet-tab--active");
  });

  it("switches sheets and updates the scene", async () => {
    const api = createMockExcalidrawAPI();

    // Setup 2 sheets
    const index = {
      activeSheetId: "sheet-1",
      sheets: [
        { id: "sheet-1", title: "Sheet 1", createdAt: 1, updatedAt: 1 },
        { id: "sheet-2", title: "Sheet 2", createdAt: 2, updatedAt: 2 },
      ],
    };
    saveSheetsIndex(index);

    await saveSheetData("sheet-2", {
      elements: [
        {
          id: "rect-sheet-2",
          type: "rectangle",
          x: 10,
          y: 10,
          width: 100,
          height: 100,
          isDeleted: false,
        } as any,
      ],
      appState: {},
    });

    render(<SheetManager excalidrawAPI={api} />);

    await waitFor(() => {
      expect(screen.getByText("Sheet 2")).toBeInTheDocument();
    });

    const sheet2Tab = screen.getByText("Sheet 2").closest(".sheet-tab")!;
    await act(async () => {
      fireEvent.click(sheet2Tab);
    });

    await waitFor(() => {
      expect(sheet2Tab).toHaveClass("sheet-tab--active");
      expect(api.updateScene).toHaveBeenCalled();
    });

    const lastCall = api.updateScene.mock.calls.at(-1)[0];
    expect(lastCall.elements[0].id).toBe("rect-sheet-2");
  });

  it("renames sheet inline via double click", async () => {
    const api = createMockExcalidrawAPI();

    render(<SheetManager excalidrawAPI={api} />);

    await waitFor(() => {
      expect(screen.getByText("Sheet 1")).toBeInTheDocument();
    });

    const tab = screen.getByText("Sheet 1").closest(".sheet-tab")!;
    fireEvent.doubleClick(tab);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("Sheet 1");

    fireEvent.change(input, { target: { value: "Architecture Diagram" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("Architecture Diagram")).toBeInTheDocument();
      expect(screen.queryByRole("textbox")).toBeNull();
    });

    const updatedIndex = getSheetsIndex();
    expect(updatedIndex?.sheets[0].title).toBe("Architecture Diagram");
  });

  it("duplicates sheet from menu", async () => {
    const api = createMockExcalidrawAPI();

    await saveSheetData("sheet-1", {
      elements: [
        {
          id: "circle-1",
          type: "ellipse",
          x: 0,
          y: 0,
          isDeleted: false,
        } as any,
      ],
      appState: {},
    });
    saveSheetsIndex({
      activeSheetId: "sheet-1",
      sheets: [
        { id: "sheet-1", title: "My Sheet", createdAt: 1, updatedAt: 1 },
      ],
    });

    render(<SheetManager excalidrawAPI={api} />);

    await waitFor(() => {
      expect(screen.getByText("My Sheet")).toBeInTheDocument();
    });

    const menuBtn = screen.getByLabelText("Options for My Sheet");
    fireEvent.click(menuBtn);

    const duplicateBtn = screen.getByText("Duplicate");
    await act(async () => {
      fireEvent.click(duplicateBtn);
    });

    await waitFor(() => {
      expect(screen.getByText("My Sheet (Copy)")).toBeInTheDocument();
    });

    const copyTab = screen.getByText("My Sheet (Copy)").closest(".sheet-tab");
    expect(copyTab).toHaveClass("sheet-tab--active");
  });

  it("deletes active sheet and switches to adjacent, and deletes only sheet resets to Sheet 1", async () => {
    const api = createMockExcalidrawAPI();

    saveSheetsIndex({
      activeSheetId: "sheet-1",
      sheets: [
        { id: "sheet-1", title: "Sheet 1", createdAt: 1, updatedAt: 1 },
        { id: "sheet-2", title: "Sheet 2", createdAt: 2, updatedAt: 2 },
      ],
    });

    render(<SheetManager excalidrawAPI={api} />);

    await waitFor(() => {
      expect(screen.getByText("Sheet 1")).toBeInTheDocument();
    });

    // Delete Sheet 1
    const menuBtn = screen.getByLabelText("Options for Sheet 1");
    fireEvent.click(menuBtn);

    const deleteMenuItem = screen.getByText("Delete");
    fireEvent.click(deleteMenuItem);

    // Confirm dialog appears
    const confirmDeleteBtn = screen.getByRole("button", { name: "Delete" });
    await act(async () => {
      fireEvent.click(confirmDeleteBtn);
    });

    await waitFor(() => {
      expect(screen.queryByText("Sheet 1")).toBeNull();
      expect(screen.getByText("Sheet 2")).toBeInTheDocument();
    });

    const sheet2Tab = screen.getByText("Sheet 2").closest(".sheet-tab");
    expect(sheet2Tab).toHaveClass("sheet-tab--active");

    // Now delete Sheet 2 (the only sheet left)
    const menuBtn2 = screen.getByLabelText("Options for Sheet 2");
    fireEvent.click(menuBtn2);

    const deleteMenuItem2 = screen.getByText("Delete");
    fireEvent.click(deleteMenuItem2);

    const confirmDeleteBtn2 = screen.getByRole("button", { name: "Delete" });
    await act(async () => {
      fireEvent.click(confirmDeleteBtn2);
    });

    await waitFor(() => {
      expect(screen.getByText("Sheet 1")).toBeInTheDocument();
    });

    expect(api.resetScene).toHaveBeenCalled();
  });
});
