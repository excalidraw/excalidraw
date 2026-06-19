import type { ExcalidrawFreeDrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import { act, fireEvent, render, screen } from "./test-utils";

const { h } = window;

describe("freedraw mode action", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    // https://github.com/floating-ui/floating-ui/issues/1908#issuecomment-1301553793
    await act(async () => {});
  });

  it("applies currentItemFreedrawMode to newly drawn freedraw elements", () => {
    // default app state draws constant-width strokes
    expect(h.state.currentItemFreedrawMode).toBe("constant");

    UI.createElement("freedraw", { x: 0, y: 0 });

    expect((h.elements[0] as ExcalidrawFreeDrawElement).freedrawMode).toBe(
      "constant",
    );
  });

  it("toggling the radio updates both the selected element and the default", () => {
    const element = UI.createElement("freedraw", { x: 0, y: 0 });
    API.setSelectedElements([element.get()]);

    fireEvent.click(screen.getByTitle("Variable"));
    expect((h.elements[0] as ExcalidrawFreeDrawElement).freedrawMode).toBe(
      "variable",
    );
    expect(h.state.currentItemFreedrawMode).toBe("variable");

    fireEvent.click(screen.getByTitle("Constant"));
    expect((h.elements[0] as ExcalidrawFreeDrawElement).freedrawMode).toBe(
      "constant",
    );
    expect(h.state.currentItemFreedrawMode).toBe("constant");
  });
});
