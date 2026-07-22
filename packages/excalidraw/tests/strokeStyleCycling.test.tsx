import React from "react";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { render } from "./test-utils";

const { h } = window;

describe("stroke style cycling via Shift+<tool key>", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("Shift+R cycles currentItemStrokeStyle through solid → dashed → dotted", () => {
    // Activate rectangle tool first
    Keyboard.keyPress(KEYS.R);
    expect(h.state.activeTool.type).toBe("rectangle");
    expect(h.state.currentItemStrokeStyle).toBe("solid");

    // First cycle: solid → dashed
    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyPress(KEYS.R);
    });
    expect(h.state.currentItemStrokeStyle).toBe("dashed");

    // Second cycle: dashed → dotted
    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyPress(KEYS.R);
    });
    expect(h.state.currentItemStrokeStyle).toBe("dotted");

    // Third cycle: dotted → solid (wraps around)
    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyPress(KEYS.R);
    });
    expect(h.state.currentItemStrokeStyle).toBe("solid");
  });

  it("Shift+A cycles stroke style independently from arrow type cycling", () => {
    Keyboard.keyPress(KEYS.A);
    expect(h.state.activeTool.type).toBe("arrow");
    const initialArrowType = h.state.currentItemArrowType;

    // Shift+A should cycle stroke style, not arrow type
    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyPress(KEYS.A);
    });
    expect(h.state.currentItemStrokeStyle).toBe("dashed");
    expect(h.state.currentItemArrowType).toBe(initialArrowType);

    // Bare A should cycle arrow type, not stroke style
    Keyboard.keyPress(KEYS.A);
    expect(h.state.currentItemArrowType).not.toBe(initialArrowType);
    expect(h.state.currentItemStrokeStyle).toBe("dashed");
  });

  it("Shift+D activates diamond tool and cycles stroke style when not already active", () => {
    // Start from selection tool
    expect(h.state.activeTool.type).toBe("selection");

    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyPress(KEYS.D);
    });
    expect(h.state.activeTool.type).toBe("diamond");
    expect(h.state.currentItemStrokeStyle).toBe("dashed");
  });

  it("works for all stroke-style-supporting tools", () => {
    const tools: [string, string][] = [
      [KEYS.R, "rectangle"],
      [KEYS.D, "diamond"],
      [KEYS.O, "ellipse"],
      [KEYS.A, "arrow"],
      [KEYS.L, "line"],
    ];

    for (const [key, toolType] of tools) {
      // Reset stroke style
      API.setAppState({ currentItemStrokeStyle: "solid" });

      Keyboard.withModifierKeys({ shift: true }, () => {
        Keyboard.keyPress(key);
      });
      expect(h.state.activeTool.type).toBe(toolType);
      expect(h.state.currentItemStrokeStyle).toBe("dashed");
    }
  });

  it("does not cycle for tools without stroke style support", () => {
    // Shift+T (text) should not cycle
    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyPress(KEYS.T);
    });
    expect(h.state.currentItemStrokeStyle).toBe("solid");

    // Shift+E (eraser) should not cycle
    Keyboard.withModifierKeys({ shift: true }, () => {
      Keyboard.keyPress(KEYS.E);
    });
    expect(h.state.currentItemStrokeStyle).toBe("solid");
  });
});
