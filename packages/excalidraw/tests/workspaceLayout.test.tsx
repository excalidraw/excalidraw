import React from "react";

import {
  actionResetWorkspaceLayout,
  actionToggleWorkspaceLayoutEdit,
} from "../actions";
import { clearAppStateForLocalStorage } from "../appState";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { fireEvent, render, unmountComponent } from "./test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

const queryZone = (zoneId: string) =>
  document.querySelector<HTMLElement>(
    `[data-testid="workspace-zone-${zoneId}"]`,
  );

const queryZoneControl = (control: string, zoneId: string) =>
  document.querySelector<HTMLElement>(
    `[data-testid="workspace-zone-${control}-${zoneId}"]`,
  );

const isQuickDraggable = (zoneId: string) =>
  queryZone(zoneId)!.classList.contains("workspace-zone--quick-draggable");

const dragElement = (element: HTMLElement, dx: number, dy: number) => {
  fireEvent.pointerDown(element, {
    clientX: 200,
    clientY: 200,
    pointerId: 1,
    button: 0,
  });
  fireEvent.pointerMove(element, {
    clientX: 200 + dx,
    clientY: 200 + dy,
    pointerId: 1,
  });
  fireEvent.pointerUp(element, {
    clientX: 200 + dx,
    clientY: 200 + dy,
    pointerId: 1,
  });
};

// drags via the explicit drag handle shown in edit mode
const dragZoneByHandle = (zoneId: string, dx: number, dy: number) => {
  const handle = queryZoneControl("drag", zoneId);
  expect(handle).not.toBe(null);
  dragElement(handle!, dx, dy);
};

// drags by grabbing the zone surface (normal mode, no handle shown)
const dragZoneBySurface = (zoneId: string, dx: number, dy: number) => {
  const zone = queryZone(zoneId);
  expect(zone).not.toBe(null);
  dragElement(zone!, dx, dy);
};

const resizeZone = (zoneId: string, dy: number) => {
  const handle = queryZoneControl("resize", zoneId);
  expect(handle).not.toBe(null);
  fireEvent.pointerDown(handle!, {
    clientX: 0,
    clientY: 300,
    pointerId: 1,
    button: 0,
  });
  fireEvent.pointerMove(handle!, {
    clientX: 0,
    clientY: 300 + dy,
    pointerId: 1,
  });
  fireEvent.pointerUp(handle!, { clientX: 0, clientY: 300 + dy, pointerId: 1 });
};

describe("workspace layout", () => {
  beforeEach(async () => {
    mouse.reset();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  describe("edit mode", () => {
    it("should toggle edit mode and show/hide zone controls", () => {
      expect(h.state.workspaceLayout.editing).toBe(false);
      // outside edit mode there are no controls, only the grab-draggable zone
      expect(queryZoneControl("drag", "toolbar")).toBe(null);
      expect(queryZoneControl("lock", "toolbar")).toBe(null);
      expect(queryZoneControl("visibility", "toolbar")).toBe(null);
      expect(queryZoneControl("reset", "toolbar")).toBe(null);
      expect(isQuickDraggable("toolbar")).toBe(true);

      API.executeAction(actionToggleWorkspaceLayoutEdit);
      expect(h.state.workspaceLayout.editing).toBe(true);

      for (const zoneId of ["toolbar", "zoom", "undoRedo", "libraryButton"]) {
        expect(queryZone(zoneId)).not.toBe(null);
        expect(queryZoneControl("drag", zoneId)).not.toBe(null);
        expect(queryZoneControl("lock", zoneId)).not.toBe(null);
        expect(queryZoneControl("visibility", zoneId)).not.toBe(null);
        expect(queryZoneControl("reset", zoneId)).not.toBe(null);
      }
      expect(isQuickDraggable("toolbar")).toBe(false);

      // the hamburger / main menu zone is editable, but cannot be hidden
      // since it is the entry point to the Preferences menu
      expect(queryZone("mainMenu")).not.toBe(null);
      expect(queryZoneControl("drag", "mainMenu")).not.toBe(null);
      expect(queryZoneControl("lock", "mainMenu")).not.toBe(null);
      expect(queryZoneControl("reset", "mainMenu")).not.toBe(null);
      expect(queryZoneControl("visibility", "mainMenu")).toBe(null);

      API.executeAction(actionToggleWorkspaceLayoutEdit);
      expect(h.state.workspaceLayout.editing).toBe(false);
      expect(queryZoneControl("drag", "toolbar")).toBe(null);
      expect(queryZoneControl("lock", "toolbar")).toBe(null);
      expect(isQuickDraggable("toolbar")).toBe(true);
    });

    it("should render the properties panel placeholder while editing", () => {
      expect(queryZone("propertiesPanel")).toBe(null);

      API.executeAction(actionToggleWorkspaceLayoutEdit);
      expect(queryZone("propertiesPanel")).not.toBe(null);
      expect(queryZoneControl("resize", "propertiesPanel")).not.toBe(null);
    });
  });

  describe("dragging in edit mode", () => {
    it("should move an unlocked zone and persist its offset", () => {
      API.executeAction(actionToggleWorkspaceLayoutEdit);

      dragZoneByHandle("zoom", 40, -25);

      expect(h.state.workspaceLayout.zones.zoom).toEqual(
        expect.objectContaining({ offsetX: 40, offsetY: -25 }),
      );
      expect(queryZone("zoom")!.style.transform).toBe("translate(40px, -25px)");

      // dragging again accumulates from the stored offset
      dragZoneByHandle("zoom", -10, 5);
      expect(h.state.workspaceLayout.zones.zoom).toEqual(
        expect.objectContaining({ offsetX: 30, offsetY: -20 }),
      );
    });

    it("should not move a locked zone", () => {
      API.executeAction(actionToggleWorkspaceLayoutEdit);

      fireEvent.click(queryZoneControl("lock", "zoom")!);
      expect(h.state.workspaceLayout.zones.zoom?.locked).toBe(true);

      dragZoneByHandle("zoom", 40, 40);

      expect(h.state.workspaceLayout.zones.zoom?.offsetX ?? 0).toBe(0);
      expect(h.state.workspaceLayout.zones.zoom?.offsetY ?? 0).toBe(0);
      expect(queryZone("zoom")!.style.transform).toBe("");

      // unlocking re-enables dragging
      fireEvent.click(queryZoneControl("lock", "zoom")!);
      dragZoneByHandle("zoom", 40, 40);
      expect(h.state.workspaceLayout.zones.zoom).toEqual(
        expect.objectContaining({ offsetX: 40, offsetY: 40 }),
      );
    });
  });

  describe("dragging outside edit mode", () => {
    it("should drag the main menu zone by grabbing it and persist the offset", () => {
      expect(h.state.workspaceLayout.editing).toBe(false);
      // no drag handle is rendered outside edit mode
      expect(queryZoneControl("drag", "mainMenu")).toBe(null);
      expect(isQuickDraggable("mainMenu")).toBe(true);

      dragZoneBySurface("mainMenu", 30, 60);

      expect(h.state.workspaceLayout.zones.mainMenu).toEqual(
        expect.objectContaining({ offsetX: 30, offsetY: 60 }),
      );
      expect(queryZone("mainMenu")!.style.transform).toBe(
        "translate(30px, 60px)",
      );

      const persisted = clearAppStateForLocalStorage(h.state);
      expect(persisted.workspaceLayout?.zones.mainMenu).toEqual(
        expect.objectContaining({ offsetX: 30, offsetY: 60 }),
      );
    });

    it("should drag any unlocked zone by grabbing it outside edit mode", () => {
      dragZoneBySurface("undoRedo", -15, -30);

      expect(h.state.workspaceLayout.editing).toBe(false);
      expect(h.state.workspaceLayout.zones.undoRedo).toEqual(
        expect.objectContaining({ offsetX: -15, offsetY: -30 }),
      );
    });

    it("should not start dragging from interactive elements inside a zone", () => {
      const undoButton = document.querySelector<HTMLElement>(
        '[data-testid="button-undo"]',
      );
      expect(undoButton).not.toBe(null);

      dragElement(undoButton!, 50, 50);

      expect(h.state.workspaceLayout.zones.undoRedo).toBeUndefined();
      expect(queryZone("undoRedo")!.style.transform).toBe("");
    });

    it("should keep locked zones fixed outside edit mode", () => {
      API.executeAction(actionToggleWorkspaceLayoutEdit);
      fireEvent.click(queryZoneControl("lock", "zoom")!);
      API.executeAction(actionToggleWorkspaceLayoutEdit);

      // locked zones aren't grab-draggable in normal mode
      expect(queryZone("zoom")).not.toBe(null);
      expect(isQuickDraggable("zoom")).toBe(false);
      dragZoneBySurface("zoom", 40, 40);
      expect(h.state.workspaceLayout.zones.zoom?.offsetX ?? 0).toBe(0);
      expect(queryZone("zoom")!.style.transform).toBe("");

      // unlocked zones still are
      expect(isQuickDraggable("undoRedo")).toBe(true);
    });
  });

  describe("resizing", () => {
    it("should resize the properties panel and persist its height", () => {
      API.executeAction(actionToggleWorkspaceLayoutEdit);

      // jsdom reports no measurable height, so resizing starts from the
      // minimum zone height (120)
      resizeZone("propertiesPanel", 80);
      expect(h.state.workspaceLayout.zones.propertiesPanel?.height).toBe(200);
      expect(
        queryZone("propertiesPanel")!.style.getPropertyValue(
          "--workspace-zone-height",
        ),
      ).toBe("200px");

      // shrinking below the minimum clamps to it
      resizeZone("propertiesPanel", -200);
      expect(h.state.workspaceLayout.zones.propertiesPanel?.height).toBe(120);

      const persisted = clearAppStateForLocalStorage(h.state);
      expect(persisted.workspaceLayout?.zones.propertiesPanel?.height).toBe(
        120,
      );
    });

    it("should keep grab-dragging and resizing available outside edit mode for the unlocked properties panel", () => {
      // the panel only renders in normal mode once an element is selected
      UI.createElement("rectangle", { x: 100, y: 100, size: 50 });

      expect(h.state.workspaceLayout.editing).toBe(false);
      expect(queryZone("propertiesPanel")).not.toBe(null);
      expect(isQuickDraggable("propertiesPanel")).toBe(true);
      expect(queryZoneControl("resize", "propertiesPanel")).not.toBe(null);
      // no edit-only controls in normal mode
      expect(queryZoneControl("drag", "propertiesPanel")).toBe(null);
      expect(queryZoneControl("lock", "propertiesPanel")).toBe(null);
      expect(queryZoneControl("visibility", "propertiesPanel")).toBe(null);

      dragZoneBySurface("propertiesPanel", 25, 35);
      expect(h.state.workspaceLayout.zones.propertiesPanel).toEqual(
        expect.objectContaining({ offsetX: 25, offsetY: 35 }),
      );

      resizeZone("propertiesPanel", 100);
      expect(h.state.workspaceLayout.zones.propertiesPanel?.height).toBe(220);
    });

    it("should not show a resize handle on zones that don't support resizing", () => {
      API.executeAction(actionToggleWorkspaceLayoutEdit);

      for (const zoneId of [
        "mainMenu",
        "toolbar",
        "zoom",
        "undoRedo",
        "libraryButton",
      ]) {
        expect(queryZoneControl("resize", zoneId)).toBe(null);
      }
    });
  });

  describe("hide and show", () => {
    it("should hide a zone in normal mode and show it as ghost while editing", () => {
      API.executeAction(actionToggleWorkspaceLayoutEdit);

      fireEvent.click(queryZoneControl("visibility", "undoRedo")!);
      expect(h.state.workspaceLayout.zones.undoRedo?.visible).toBe(false);

      // still rendered as a ghost while editing
      expect(queryZone("undoRedo")).not.toBe(null);
      expect(
        queryZone("undoRedo")!.classList.contains("workspace-zone--ghost"),
      ).toBe(true);

      // gone in normal mode
      API.executeAction(actionToggleWorkspaceLayoutEdit);
      expect(queryZone("undoRedo")).toBe(null);

      // can be shown again from edit mode
      API.executeAction(actionToggleWorkspaceLayoutEdit);
      fireEvent.click(queryZoneControl("visibility", "undoRedo")!);
      expect(h.state.workspaceLayout.zones.undoRedo?.visible).toBe(true);
      API.executeAction(actionToggleWorkspaceLayoutEdit);
      expect(queryZone("undoRedo")).not.toBe(null);
    });

    it("should persist the workspace layout to browser storage", () => {
      API.executeAction(actionToggleWorkspaceLayoutEdit);
      fireEvent.click(queryZoneControl("visibility", "zoom")!);
      dragZoneByHandle("undoRedo", 12, 34);

      const persisted = clearAppStateForLocalStorage(h.state);
      expect(persisted.workspaceLayout).toEqual({
        editing: true,
        zones: {
          zoom: expect.objectContaining({ visible: false }),
          undoRedo: expect.objectContaining({ offsetX: 12, offsetY: 34 }),
        },
      });
    });

    it("should restore persisted layout on load with edit mode disabled", async () => {
      // drop the app rendered in beforeEach so DOM queries only see the
      // freshly-loaded instance
      unmountComponent();
      await render(
        <Excalidraw
          initialData={{
            appState: {
              workspaceLayout: {
                editing: true,
                zones: {
                  zoom: {
                    offsetX: 0,
                    offsetY: 0,
                    visible: false,
                    locked: false,
                  },
                  toolbar: {
                    offsetX: 50,
                    offsetY: 10,
                    visible: true,
                    locked: true,
                  },
                  propertiesPanel: {
                    offsetX: 0,
                    offsetY: 0,
                    visible: true,
                    locked: false,
                    height: 240,
                  },
                },
              },
            },
          }}
        />,
      );

      // edit mode is transient and must not survive a reload
      expect(h.state.workspaceLayout.editing).toBe(false);
      expect(h.state.workspaceLayout.zones.zoom?.visible).toBe(false);
      expect(h.state.workspaceLayout.zones.toolbar).toEqual(
        expect.objectContaining({ offsetX: 50, offsetY: 10, locked: true }),
      );
      expect(h.state.workspaceLayout.zones.propertiesPanel?.height).toBe(240);

      expect(queryZone("zoom")).toBe(null);
      expect(queryZone("toolbar")!.style.transform).toBe(
        "translate(50px, 10px)",
      );
      // the locked toolbar isn't grab-draggable after reload, unlocked zones are
      expect(isQuickDraggable("toolbar")).toBe(false);
      expect(isQuickDraggable("undoRedo")).toBe(true);
    });
  });

  describe("reset", () => {
    it("should reset a single zone via its control", () => {
      API.executeAction(actionToggleWorkspaceLayoutEdit);
      dragZoneByHandle("zoom", 40, 40);
      expect(h.state.workspaceLayout.zones.zoom).toBeDefined();

      fireEvent.click(queryZoneControl("reset", "zoom")!);
      expect(h.state.workspaceLayout.zones.zoom).toBeUndefined();
      expect(queryZone("zoom")!.style.transform).toBe("");
    });

    it("should restore the default layout via the global reset action", () => {
      API.executeAction(actionToggleWorkspaceLayoutEdit);
      dragZoneByHandle("toolbar", 100, 20);
      dragZoneByHandle("mainMenu", 10, 10);
      fireEvent.click(queryZoneControl("visibility", "undoRedo")!);
      fireEvent.click(queryZoneControl("lock", "zoom")!);
      expect(Object.keys(h.state.workspaceLayout.zones)).not.toHaveLength(0);

      API.executeAction(actionResetWorkspaceLayout);

      expect(h.state.workspaceLayout.zones).toEqual({});
      // edit mode itself is not affected by the reset
      expect(h.state.workspaceLayout.editing).toBe(true);

      API.executeAction(actionToggleWorkspaceLayoutEdit);
      expect(queryZone("toolbar")!.style.transform).toBe("");
      expect(queryZone("mainMenu")!.style.transform).toBe("");
      expect(queryZone("undoRedo")).not.toBe(null);
    });
  });

  describe("regressions", () => {
    it("should not break drawing, undo or redo after layout changes", () => {
      API.executeAction(actionToggleWorkspaceLayoutEdit);
      dragZoneByHandle("toolbar", 60, 30);
      dragZoneByHandle("zoom", -20, -40);
      API.executeAction(actionToggleWorkspaceLayoutEdit);
      dragZoneBySurface("mainMenu", 15, 0);

      const rect = UI.createElement("rectangle", {
        x: 100,
        y: 100,
        size: 50,
      });
      expect(h.elements.length).toBe(1);
      expect(rect.isDeleted).toBe(false);

      Keyboard.undo();
      expect(h.elements[0].isDeleted).toBe(true);

      Keyboard.redo();
      expect(h.elements[0].isDeleted).toBe(false);

      // selecting the element shows the (relocated) properties panel zone
      mouse.clickOn(rect);
      expect(queryZone("propertiesPanel")).not.toBe(null);
    });
  });
});
