import { actionToggleShowHints } from "../actions";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import { render, unmountComponent } from "./test-utils";

unmountComponent();

const { h } = window;

const getHintText = () =>
  h.app.ownerDocument.querySelector(".HintViewer")?.textContent ?? null;

describe("showHints preference", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  describe("actionToggleShowHints", () => {
    it("is registered under the `showHints` name", () => {
      // the command palette looks the action up by name, so an unregistered
      // action would silently become an `undefined` palette entry
      expect(actionToggleShowHints).toBeDefined();
      expect(h.app.actionManager.actions.showHints).toBe(actionToggleShowHints);
    });

    it("checked() reflects the current showHints value", () => {
      expect(actionToggleShowHints.checked!(h.state)).toBe(true);

      API.setAppState({ showHints: false });

      expect(actionToggleShowHints.checked!(h.state)).toBe(false);
    });

    it("toggles showHints off and back on", () => {
      API.executeAction(actionToggleShowHints);
      expect(h.state.showHints).toBe(false);

      API.executeAction(actionToggleShowHints);
      expect(h.state.showHints).toBe(true);
    });
  });

  describe("HintViewer", () => {
    it("renders the active tool's hint while showHints is on", () => {
      UI.clickTool("freedraw");

      expect(getHintText()).toBe(
        "Click and drag, release when you're finished",
      );
    });

    it("renders nothing once the preference is toggled off", () => {
      UI.clickTool("freedraw");
      expect(getHintText()).not.toBe(null);

      API.executeAction(actionToggleShowHints);

      expect(getHintText()).toBe(null);
    });

    it("comes back when the preference is toggled on again", () => {
      UI.clickTool("freedraw");
      API.executeAction(actionToggleShowHints);
      expect(getHintText()).toBe(null);

      API.executeAction(actionToggleShowHints);

      expect(getHintText()).toBe(
        "Click and drag, release when you're finished",
      );
    });
  });
});
