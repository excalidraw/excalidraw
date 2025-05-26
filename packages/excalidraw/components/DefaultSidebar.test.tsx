import React from "react";

import { DEFAULT_SIDEBAR } from "@excalidraw/common";

import { DefaultSidebar } from "../index";
import {
  fireEvent,
  waitFor,
  withExcalidrawDimensions,
} from "../tests/test-utils";

import {
  assertExcalidrawWithSidebar,
  assertSidebarDockButton,
} from "./Sidebar/siderbar.test.helpers";

const { h } = window;

describe("DefaultSidebar", () => {
  it("when `docked={undefined}` & `onDock={undefined}`, should allow docking", async () => {
    await assertExcalidrawWithSidebar(
      <DefaultSidebar />,
      DEFAULT_SIDEBAR.name,
      async () => {
        expect(h.state.defaultSidebarDockedPreference).toBe(false);

        const { dockButton } = await assertSidebarDockButton(true);

        fireEvent.click(dockButton);
        await waitFor(() => {
          expect(h.state.defaultSidebarDockedPreference).toBe(true);
          expect(dockButton).toHaveClass("selected");
        });

        fireEvent.click(dockButton);
        await waitFor(() => {
          expect(h.state.defaultSidebarDockedPreference).toBe(false);
          expect(dockButton).not.toHaveClass("selected");
        });
      },
    );
  });

  it("when `docked={undefined}` & `onDock`, should allow docking", async () => {
    await assertExcalidrawWithSidebar(
      <DefaultSidebar onDock={() => {}} />,
      DEFAULT_SIDEBAR.name,
      async () => {
        expect(h.state.defaultSidebarDockedPreference).toBe(false);

        const { dockButton } = await assertSidebarDockButton(true);

        fireEvent.click(dockButton);
        await waitFor(() => {
          expect(h.state.defaultSidebarDockedPreference).toBe(true);
          expect(dockButton).toHaveClass("selected");
        });

        fireEvent.click(dockButton);
        await waitFor(() => {
          expect(h.state.defaultSidebarDockedPreference).toBe(false);
          expect(dockButton).not.toHaveClass("selected");
        });
      },
    );
  });

  it("when `docked={true}` & `onDock`, should allow docking", async () => {
    await assertExcalidrawWithSidebar(
      <DefaultSidebar onDock={() => {}} />,
      DEFAULT_SIDEBAR.name,
      async () => {
        expect(h.state.defaultSidebarDockedPreference).toBe(false);

        const { dockButton } = await assertSidebarDockButton(true);

        fireEvent.click(dockButton);
        await waitFor(() => {
          expect(h.state.defaultSidebarDockedPreference).toBe(true);
          expect(dockButton).toHaveClass("selected");
        });

        fireEvent.click(dockButton);
        await waitFor(() => {
          expect(h.state.defaultSidebarDockedPreference).toBe(false);
          expect(dockButton).not.toHaveClass("selected");
        });
      },
    );
  });

  it("when `onDock={false}`, should disable docking", async () => {
    await assertExcalidrawWithSidebar(
      <DefaultSidebar onDock={false} />,
      DEFAULT_SIDEBAR.name,
      async () => {
        await withExcalidrawDimensions(
          { width: 1920, height: 1080 },
          async () => {
            expect(h.state.defaultSidebarDockedPreference).toBe(false);

            await assertSidebarDockButton(false);
          },
        );
      },
    );
  });

  it("when `docked={true}` & `onDock={false}`, should force-dock sidebar", async () => {
    await assertExcalidrawWithSidebar(
      <DefaultSidebar docked onDock={false} />,
      DEFAULT_SIDEBAR.name,
      async () => {
        expect(h.state.defaultSidebarDockedPreference).toBe(false);

        const { sidebar } = await assertSidebarDockButton(false);
        expect(sidebar).toHaveClass("sidebar--docked");
      },
    );
  });

  it("when `docked={true}` & `onDock={undefined}`, should force-dock sidebar", async () => {
    await assertExcalidrawWithSidebar(
      <DefaultSidebar docked />,
      DEFAULT_SIDEBAR.name,
      async () => {
        expect(h.state.defaultSidebarDockedPreference).toBe(false);

        const { sidebar } = await assertSidebarDockButton(false);
        expect(sidebar).toHaveClass("sidebar--docked");
      },
    );
  });

  it("when `docked={false}` & `onDock={undefined}`, should force-undock sidebar", async () => {
    await assertExcalidrawWithSidebar(
      <DefaultSidebar docked={false} />,
      DEFAULT_SIDEBAR.name,
      async () => {
        expect(h.state.defaultSidebarDockedPreference).toBe(false);

        const { sidebar } = await assertSidebarDockButton(false);
        expect(sidebar).not.toHaveClass("sidebar--docked");
      },
    );
  });
});
