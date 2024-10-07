import type { ExcalidrawElement } from "../element/types";
import { getShortcutKey } from "../utils";
import { API } from "./helpers/api";
import { render } from "./test-utils";
import { Excalidraw } from "../index";
import {
  getShortcutFromShortcutName,
  registerCustomShortcuts,
} from "../actions/shortcuts";
import type {
  Action,
  ActionPredicateFn,
  ActionResult,
  CustomActionName,
} from "../actions/types";
import { makeCustomActionName } from "../actions/types";
import {
  actionChangeFontFamily,
  actionChangeFontSize,
} from "../actions/actionProperties";
import { isTextElement } from "../element";

const { h } = window;

describe("regression tests", () => {
  it("should retrieve custom shortcuts", () => {
    const shortcutName = makeCustomActionName("test");
    const shortcuts: Record<CustomActionName, string[]> = {};
    shortcuts[shortcutName] = [
      getShortcutKey("CtrlOrCmd+1"),
      getShortcutKey("CtrlOrCmd+2"),
    ];
    registerCustomShortcuts(shortcuts);
    expect(getShortcutFromShortcutName(shortcutName)).toBe("Ctrl+1");
  });

  it("should apply universal action predicates", async () => {
    await render(<Excalidraw />);
    // Create the test elements
    const el1 = API.createElement({ type: "rectangle", id: "A", y: 0 });
    const el2 = API.createElement({ type: "rectangle", id: "B", y: 30 });
    const el3 = API.createElement({ type: "text", id: "C", y: 60 });
    const el12: ExcalidrawElement[] = [el1, el2];
    const el13: ExcalidrawElement[] = [el1, el3];
    const el23: ExcalidrawElement[] = [el2, el3];
    const el123: ExcalidrawElement[] = [el1, el2, el3];
    // Set up the custom Action enablers
    const enableName = "custom.enable";
    const enableAction: Action = {
      name: enableName,
      label: "",
      perform: (): ActionResult => {
        return {} as ActionResult;
      },
      trackEvent: false,
    };
    const enabler: ActionPredicateFn = function (action, elements) {
      if (action.name !== enableName || elements.some((el) => el.y === 30)) {
        return true;
      }
      return false;
    };
    // Set up the standard Action disablers
    const disabled1 = actionChangeFontFamily;
    const disabled2 = actionChangeFontSize;
    const disabler: ActionPredicateFn = function (action, elements) {
      if (
        action.name === disabled2.name &&
        elements.some((el) => el.y === 0 || isTextElement(el))
      ) {
        return false;
      }
      return true;
    };
    // Test the custom Action enablers
    const am = h.app.actionManager;
    am.registerActionPredicate(enabler);
    expect(am.isActionEnabled(enableAction, { elements: el12 })).toBe(true);
    expect(am.isActionEnabled(enableAction, { elements: el13 })).toBe(false);
    expect(am.isActionEnabled(enableAction, { elements: el23 })).toBe(true);
    expect(am.isActionEnabled(disabled1, { elements: el12 })).toBe(true);
    expect(am.isActionEnabled(disabled1, { elements: el13 })).toBe(true);
    expect(am.isActionEnabled(disabled1, { elements: el23 })).toBe(true);
    // Test the standard Action disablers
    am.registerActionPredicate(disabler);
    expect(am.isActionEnabled(disabled1, { elements: el123 })).toBe(true);
    expect(am.isActionEnabled(disabled2, { elements: [el1] })).toBe(false);
    expect(am.isActionEnabled(disabled2, { elements: [el2] })).toBe(true);
    expect(am.isActionEnabled(disabled2, { elements: [el3] })).toBe(false);
    expect(am.isActionEnabled(disabled2, { elements: el12 })).toBe(false);
    expect(am.isActionEnabled(disabled2, { elements: el23 })).toBe(false);
    expect(am.isActionEnabled(disabled2, { elements: el13 })).toBe(false);
  });
});
