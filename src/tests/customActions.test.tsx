import { ExcalidrawElement } from "../element/types";
import { getShortcutKey } from "../utils";
import { API } from "./helpers/api";
import {
  CustomShortcutName,
  getShortcutFromShortcutName,
  registerCustomShortcuts,
} from "../actions/shortcuts";
import { Action, ActionName, DisableFn, EnableFn } from "../actions/types";
import {
  getActionDisablers,
  getActionEnablers,
  registerDisableFn,
  registerEnableFn,
} from "../actions/guards";

const { h } = window;

describe("regression tests", () => {
  it("should retrieve custom shortcuts", () => {
    const shortcuts: Record<CustomShortcutName, string[]> = {
      test: [getShortcutKey("CtrlOrCmd+1"), getShortcutKey("CtrlOrCmd+2")],
    };
    registerCustomShortcuts(shortcuts);
    expect(getShortcutFromShortcutName("test")).toBe("Ctrl+1");
  });

  it("should follow action guards", () => {
    // Create the test elements
    const text1 = API.createElement({ type: "rectangle", id: "A", y: 0 });
    const text2 = API.createElement({ type: "rectangle", id: "B", y: 30 });
    const text3 = API.createElement({ type: "rectangle", id: "C", y: 60 });
    const el12: ExcalidrawElement[] = [text1, text2];
    const el13: ExcalidrawElement[] = [text1, text3];
    const el23: ExcalidrawElement[] = [text2, text3];
    const el123: ExcalidrawElement[] = [text1, text2, text3];
    // Set up the custom Action enablers
    const enableName = "custom" as Action["name"];
    const enabler: EnableFn = function (elements) {
      if (elements.some((el) => el.y === 30)) {
        return true;
      }
      return false;
    };
    registerEnableFn(enableName, enabler);
    // Set up the standard Action disablers
    const disableName1 = "changeFontFamily" as ActionName;
    const disableName2 = "changeFontSize" as ActionName;
    const disabler: DisableFn = function (elements) {
      if (elements.some((el) => el.y === 0)) {
        return true;
      }
      return false;
    };
    registerDisableFn(disableName1, disabler);
    // Test the custom Action enablers
    const enablers = getActionEnablers();
    const isCustomEnabled = function (
      elements: ExcalidrawElement[],
      name: string,
    ) {
      return (
        name in enablers &&
        enablers[name].some((enabler) => enabler(elements, h.state, name))
      );
    };
    expect(isCustomEnabled(el12, enableName)).toBe(true);
    expect(isCustomEnabled(el13, enableName)).toBe(false);
    expect(isCustomEnabled(el23, enableName)).toBe(true);
    // Test the standard Action disablers
    const disablers = getActionDisablers();
    const isStandardDisabled = function (
      elements: ExcalidrawElement[],
      name: ActionName,
    ) {
      return (
        name in disablers &&
        disablers[name].some((disabler) => disabler(elements, h.state, name))
      );
    };
    expect(isStandardDisabled(el12, disableName1)).toBe(true);
    expect(isStandardDisabled(el23, disableName1)).toBe(false);
    expect(isStandardDisabled(el123, disableName2)).toBe(false);
  });
});
