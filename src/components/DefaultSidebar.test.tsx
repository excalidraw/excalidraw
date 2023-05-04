import React from "react";
import { DEFAULT_SIDEBAR } from "../constants";
import { DefaultSidebar, Excalidraw } from "../packages/excalidraw/index";
import {
  act,
  fireEvent,
  queryByTestId,
  render,
  waitFor,
  withExcalidrawDimensions,
} from "../tests/test-utils";
import { assertSidebarDockButton } from "./Sidebar/Sidebar.test";

describe("DefaultSidebar", () => {
  it("DefaultSidebar docking should be fully-controlled when `docked` prop passed", async () => {
    let _setDocked: (docked?: boolean) => void = null!;

    const CustomExcalidraw = () => {
      const [docked, setDocked] = React.useState<boolean | undefined>();
      _setDocked = setDocked;
      return (
        <Excalidraw
          initialData={{
            appState: { openSidebar: { name: DEFAULT_SIDEBAR.name } },
          }}
        >
          <DefaultSidebar className="test-sidebar" docked={docked}>
            hello
          </DefaultSidebar>
        </Excalidraw>
      );
    };

    const { container } = await render(<CustomExcalidraw />);

    const { h } = window;

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      // if `docked={undefined}` passed, should allow docking as normal
      // -------------------------------------------------------------------------

      {
        expect(h.state.defaultSidebarDockedPreference).toBe(false);

        const dockButton = await waitFor(() => {
          const sidebar = container.querySelector<HTMLElement>(".test-sidebar");
          expect(sidebar).not.toBe(null);
          const dockButton = queryByTestId(sidebar!, "sidebar-dock");
          expect(dockButton).not.toBe(null);
          return dockButton!;
        });

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
      }

      // once `docked` is defined, shouldn't allow docking for DefaultSidebar
      // -------------------------------------------------------------------------

      act(() => {
        _setDocked(true);
      });

      await waitFor(() => {
        const sidebar = container.querySelector<HTMLElement>(".test-sidebar");
        expect(sidebar).not.toBe(null);

        const dockButton = queryByTestId(sidebar!, "sidebar-dock");
        expect(dockButton).toBe(null);

        // defaultSidebarDockedPreference is disconnected from the actual
        // docked state
        expect(h.state.defaultSidebarDockedPreference).toBe(false);
      });

      act(() => {
        _setDocked(false);
      });

      await waitFor(() => {
        const sidebar = container.querySelector<HTMLElement>(".test-sidebar");
        expect(sidebar).not.toBe(null);

        const dockButton = queryByTestId(sidebar!, "sidebar-dock");
        expect(dockButton).toBe(null);

        // defaultSidebarDockedPreference is disconnected from the actual
        // docked state
        expect(h.state.defaultSidebarDockedPreference).toBe(false);
      });

      // reverting back to `docked={undefined}` should allow docking again
      // -----------------------------------------------------------------------

      {
        act(() => {
          _setDocked(undefined);
        });

        expect(h.state.defaultSidebarDockedPreference).toBe(false);

        const dockButton = await waitFor(() => {
          const sidebar = container.querySelector<HTMLElement>(".test-sidebar");
          expect(sidebar).not.toBe(null);
          const dockButton = queryByTestId(sidebar!, "sidebar-dock");
          expect(dockButton).not.toBe(null);
          return dockButton!;
        });

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
      }
    });
  });

  it("DefaultSidebar — dockable behavior", async () => {
    let _setOnDock: (
      value: undefined | false | (() => void),
    ) => void | undefined = null!;
    let _setDocked: (docked: boolean) => void = null!;

    const CustomExcalidraw = () => {
      const [docked, setDocked] = React.useState<boolean | undefined>();
      _setDocked = setDocked;
      const [onDock, setOnDock] = React.useState<
        (() => void) | false | undefined
      >();
      _setOnDock = setOnDock;
      return (
        <Excalidraw
          initialData={{
            appState: { openSidebar: { name: DEFAULT_SIDEBAR.name } },
          }}
        >
          <DefaultSidebar
            className="test-sidebar"
            docked={docked}
            onDock={onDock}
          >
            hello
          </DefaultSidebar>
        </Excalidraw>
      );
    };

    await render(<CustomExcalidraw />);

    const { h } = window;

    // if `docked={undefined}` & `onDock={undefined}`, should allow docking
    // as normal
    // -------------------------------------------------------------------------
    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
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
    });

    // if `docked={undefined}` & `onDock={() => {}}`, should allow docking
    // as normal (handled by editor), and only listen on changes
    // -------------------------------------------------------------------------
    act(() => {
      _setOnDock(() => {});
    });

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      expect(h.state.defaultSidebarDockedPreference).toBe(false);

      const { dockButton, sidebar } = await assertSidebarDockButton(true);

      fireEvent.click(dockButton);
      await waitFor(() => {
        expect(h.state.defaultSidebarDockedPreference).toBe(true);
        expect(dockButton).toHaveClass("selected");
        expect(sidebar).toHaveClass("sidebar--docked");
      });

      fireEvent.click(dockButton);
      await waitFor(() => {
        expect(h.state.defaultSidebarDockedPreference).toBe(false);
        expect(dockButton).not.toHaveClass("selected");
        expect(sidebar).not.toHaveClass("sidebar--docked");
      });
    });

    // if `onDock={false}`, should disable docking
    // -------------------------------------------------------------------------
    act(() => {
      _setOnDock(false);
    });

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      expect(h.state.defaultSidebarDockedPreference).toBe(false);

      await assertSidebarDockButton(false);
    });

    // if `docked={true}` & `onDock={false}`, should disable docking,
    // and force sidebar to be docked
    // -------------------------------------------------------------------------
    act(() => {
      _setDocked(true);
    });

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      expect(h.state.defaultSidebarDockedPreference).toBe(false);

      const { sidebar } = await assertSidebarDockButton(false);
      expect(sidebar).toHaveClass("sidebar--docked");
    });

    // if `docked={true}` & `onDock={undefined}`, should disable docking,
    // and force sidebar to be docked
    // -------------------------------------------------------------------------
    act(() => {
      _setDocked(true);
    });

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      expect(h.state.defaultSidebarDockedPreference).toBe(false);

      const { sidebar } = await assertSidebarDockButton(false);
      expect(sidebar).toHaveClass("sidebar--docked");
    });

    // if `docked={false}` & `onDock={undefined}`, should disable docking,
    // and force sidebar to be undocked
    // -------------------------------------------------------------------------
    act(() => {
      _setDocked(false);
    });

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      expect(h.state.defaultSidebarDockedPreference).toBe(false);

      const { sidebar } = await assertSidebarDockButton(false);
      expect(sidebar).not.toHaveClass("sidebar--docked");
    });
  });
});
