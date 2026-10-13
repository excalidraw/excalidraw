import { SAVED_PENS_MAX } from "@excalidraw/common";

import type {
  ExcalidrawFreeDrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { clearAppStateForLocalStorage } from "../appState";
import { restoreAppState } from "../data/restore";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import { act, fireEvent, queryByTestId, render, screen } from "./test-utils";

import type { SavedPen } from "../types";

const { h } = window;

const pen = (overrides: Partial<SavedPen> = {}): SavedPen => ({
  strokeColor: "#1971c2",
  strokeWidthKey: "bold",
  opacity: 40,
  strokeVariability: "variable",
  ...overrides,
});

describe("restore appState.savedPens", () => {
  it("keeps valid pens, clamps opacity and drops malformed entries", () => {
    const restored = restoreAppState(
      {
        savedPens: [
          pen(),
          pen({ opacity: 250 }),
          { ...pen(), strokeWidthKey: "huge" },
          { ...pen(), strokeVariability: "wobbly" },
          { ...pen(), strokeColor: 42 },
          "junk",
          null,
        ],
      } as any,
      null,
    );
    expect(restored.savedPens).toEqual([pen(), pen({ opacity: 100 })]);
  });

  it("caps the list and defaults malformed input to an empty list", () => {
    const many = Array.from({ length: SAVED_PENS_MAX + 5 }, (_, i) =>
      pen({ opacity: i % 101 }),
    );
    expect(
      restoreAppState({ savedPens: many } as any, null).savedPens,
    ).toHaveLength(SAVED_PENS_MAX);
    expect(
      restoreAppState({ savedPens: "junk" } as any, null).savedPens,
    ).toEqual([]);
  });

  it("is persisted to browser storage only", () => {
    const savedPens = [pen()];
    expect(clearAppStateForLocalStorage({ savedPens }).savedPens).toBe(
      savedPens,
    );
  });
});

describe("saved pens panel", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    UI.clickTool("freedraw");
  });

  afterEach(async () => {
    // https://github.com/floating-ui/floating-ui/issues/1908#issuecomment-1301553793
    await act(async () => {});
  });

  it("saves the current freedraw style once", () => {
    API.setAppState({
      currentItemStrokeColor: "#e03131",
      currentItemStrokeWidthKey: "thin",
      currentItemOpacity: 60,
      currentItemStrokeVariability: "variable",
    });

    fireEvent.click(screen.getByTestId("save-pen"));

    expect(h.state.savedPens).toEqual([
      pen({ strokeColor: "#e03131", strokeWidthKey: "thin", opacity: 60 }),
    ]);
    expect(screen.getByTestId("save-pen")).toBeDisabled();
  });

  it("shows more than ten saved pens", () => {
    const savedPens = Array.from({ length: 12 }, (_, i) =>
      pen({ opacity: i * 5 }),
    );
    API.setAppState({ savedPens });

    expect(screen.getByTestId("saved-pen-11")).toBeInTheDocument();
    expect(screen.getByTestId("save-pen")).not.toBeDisabled();
  });

  it("applies a pen to the current style and to selected freedraw elements", () => {
    const element = UI.createElement("freedraw", { x: 0, y: 0 });
    API.setSelectedElements([element.get()] as NonDeletedExcalidrawElement[]);
    API.setAppState({ savedPens: [pen()] });

    fireEvent.click(screen.getByTestId("saved-pen-0"));

    expect(h.state).toMatchObject({
      currentItemStrokeColor: "#1971c2",
      currentItemStrokeWidthKey: "bold",
      currentItemOpacity: 40,
      currentItemStrokeVariability: "variable",
    });
    const freedraw = h.elements[0] as ExcalidrawFreeDrawElement;
    expect(freedraw).toMatchObject({
      strokeColor: "#1971c2",
      strokeWidth: 2,
      opacity: 40,
    });
    expect(freedraw.strokeOptions?.variability).toBe("variable");
    expect(screen.getByTestId("saved-pen-0")).toHaveClass("active");
  });

  it("removes a pen from its context menu", async () => {
    API.setAppState({ savedPens: [pen(), pen({ strokeColor: "#2f9e44" })] });

    fireEvent.contextMenu(screen.getByTestId("saved-pen-0"));
    fireEvent.click(await screen.findByText("Remove pen"));

    expect(h.state.savedPens).toEqual([pen({ strokeColor: "#2f9e44" })]);
    expect(queryByTestId(document.body, "saved-pen-1")).not.toBeInTheDocument();
  });
});
