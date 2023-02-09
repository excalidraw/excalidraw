import React from "react";
import { Excalidraw, Sidebar } from "../../packages/excalidraw/index";
import {
  act,
  fireEvent,
  queryAllByTestId,
  queryByTestId,
  render,
  waitFor,
  withExcalidrawDimensions,
} from "../../tests/test-utils";

describe("Sidebar", () => {
  it("should render custom sidebar", async () => {
    const { container } = await render(
      <Excalidraw
        initialData={{ appState: { openSidebar: { name: "customSidebar" } } }}
        renderSidebar={() => (
          <Sidebar name="test">
            <div id="test-sidebar-content">42</div>
          </Sidebar>
        )}
      />,
    );

    const node = container.querySelector("#test-sidebar-content");
    expect(node).not.toBe(null);
  });

  it("should render custom sidebar header", async () => {
    const { container } = await render(
      <Excalidraw
        initialData={{ appState: { openSidebar: { name: "customSidebar" } } }}
        renderSidebar={() => (
          <Sidebar name="test">
            <Sidebar.Header>
              <div id="test-sidebar-header-content">42</div>
            </Sidebar.Header>
          </Sidebar>
        )}
      />,
    );

    const node = container.querySelector("#test-sidebar-header-content");
    expect(node).not.toBe(null);
    // make sure we don't render the default fallback header,
    // just the custom one
    expect(queryAllByTestId(container, "sidebar-header").length).toBe(1);
  });

  it("should render only one sidebar and prefer the custom one", async () => {
    const { container } = await render(
      <Excalidraw
        initialData={{ appState: { openSidebar: { name: "customSidebar" } } }}
        renderSidebar={() => (
          <Sidebar name="test">
            <div id="test-sidebar-content">42</div>
          </Sidebar>
        )}
      />,
    );

    await waitFor(() => {
      // make sure the custom sidebar is rendered
      const node = container.querySelector("#test-sidebar-content");
      expect(node).not.toBe(null);

      // make sure only one sidebar is rendered
      const sidebars = container.querySelectorAll(".layer-ui__sidebar");
      expect(sidebars.length).toBe(1);
    });
  });

  it("should always render custom sidebar with close button & close on click", async () => {
    const onClose = jest.fn();
    const CustomExcalidraw = () => {
      return (
        <Excalidraw
          initialData={{ appState: { openSidebar: { name: "customSidebar" } } }}
          renderSidebar={() => (
            <Sidebar name="test" className="test-sidebar" onClose={onClose}>
              hello
            </Sidebar>
          )}
        />
      );
    };

    const { container } = await render(<CustomExcalidraw />);

    const sidebar = container.querySelector<HTMLElement>(".test-sidebar");
    expect(sidebar).not.toBe(null);
    const closeButton = queryByTestId(sidebar!, "sidebar-close")!;
    expect(closeButton).not.toBe(null);

    fireEvent.click(closeButton);
    await waitFor(() => {
      expect(container.querySelector<HTMLElement>(".test-sidebar")).toBe(null);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("should render custom sidebar with dock (irrespective of onDock prop)", async () => {
    const CustomExcalidraw = () => {
      return (
        <Excalidraw
          initialData={{ appState: { openSidebar: { name: "customSidebar" } } }}
          renderSidebar={() => (
            <Sidebar name="test" className="test-sidebar">
              hello
            </Sidebar>
          )}
        />
      );
    };

    const { container } = await render(<CustomExcalidraw />);

    // should show dock button when the sidebar fits to be docked
    // -------------------------------------------------------------------------

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, () => {
      const sidebar = container.querySelector<HTMLElement>(".test-sidebar");
      expect(sidebar).not.toBe(null);
      const closeButton = queryByTestId(sidebar!, "sidebar-dock");
      expect(closeButton).not.toBe(null);
    });

    // should not show dock button when the sidebar does not fit to be docked
    // -------------------------------------------------------------------------

    await withExcalidrawDimensions({ width: 400, height: 1080 }, () => {
      const sidebar = container.querySelector<HTMLElement>(".test-sidebar");
      expect(sidebar).not.toBe(null);
      const closeButton = queryByTestId(sidebar!, "sidebar-dock");
      expect(closeButton).toBe(null);
    });
  });

  it("should support controlled docking", async () => {
    let _setDockable: (dockable: boolean) => void = null!;

    const CustomExcalidraw = () => {
      const [dockable, setDockable] = React.useState(false);
      _setDockable = setDockable;
      return (
        <Excalidraw
          initialData={{ appState: { openSidebar: { name: "customSidebar" } } }}
          renderSidebar={() => (
            <Sidebar
              name="test"
              className="test-sidebar"
              docked={false}
              dockable={dockable}
            >
              hello
            </Sidebar>
          )}
        />
      );
    };

    const { container } = await render(<CustomExcalidraw />);

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      // should not show dock button when `dockable` is `false`
      // -------------------------------------------------------------------------

      act(() => {
        _setDockable(false);
      });

      await waitFor(() => {
        const sidebar = container.querySelector<HTMLElement>(".test-sidebar");
        expect(sidebar).not.toBe(null);
        const closeButton = queryByTestId(sidebar!, "sidebar-dock");
        expect(closeButton).toBe(null);
      });

      // should show dock button when `dockable` is `true`, even if `docked`
      // prop is set
      // -------------------------------------------------------------------------

      act(() => {
        _setDockable(true);
      });

      await waitFor(() => {
        const sidebar = container.querySelector<HTMLElement>(".test-sidebar");
        expect(sidebar).not.toBe(null);
        const closeButton = queryByTestId(sidebar!, "sidebar-dock");
        expect(closeButton).not.toBe(null);
      });
    });
  });

  it("should support controlled docking", async () => {
    let _setDocked: (docked?: boolean) => void = null!;

    const CustomExcalidraw = () => {
      const [docked, setDocked] = React.useState<boolean | undefined>();
      _setDocked = setDocked;
      return (
        <Excalidraw
          initialData={{ appState: { openSidebar: { name: "customSidebar" } } }}
          renderSidebar={() => (
            <Sidebar name="test" className="test-sidebar" docked={docked}>
              hello
            </Sidebar>
          )}
        />
      );
    };

    const { container } = await render(<CustomExcalidraw />);

    const { h } = window;

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      const dockButton = await waitFor(() => {
        const sidebar = container.querySelector<HTMLElement>(".test-sidebar");
        expect(sidebar).not.toBe(null);
        const dockBotton = queryByTestId(sidebar!, "sidebar-dock");
        expect(dockBotton).not.toBe(null);
        return dockBotton!;
      });

      const dockButtonInput = dockButton.querySelector("input")!;

      // should not show dock button when `dockable` is `false`
      // -------------------------------------------------------------------------

      expect(h.state.isSidebarDocked).toBe(false);

      fireEvent.click(dockButtonInput);
      await waitFor(() => {
        expect(h.state.isSidebarDocked).toBe(true);
        expect(dockButtonInput).toBeChecked();
      });

      fireEvent.click(dockButtonInput);
      await waitFor(() => {
        expect(h.state.isSidebarDocked).toBe(false);
        expect(dockButtonInput).not.toBeChecked();
      });

      // shouldn't update `appState.isSidebarDocked` when the sidebar
      // is controlled (`docked` prop is set), as host apps should handle
      // the state themselves
      // -------------------------------------------------------------------------

      act(() => {
        _setDocked(true);
      });

      await waitFor(() => {
        expect(dockButtonInput).toBeChecked();
        expect(h.state.isSidebarDocked).toBe(false);
        expect(dockButtonInput).toBeChecked();
      });

      fireEvent.click(dockButtonInput);
      await waitFor(() => {
        expect(h.state.isSidebarDocked).toBe(false);
        expect(dockButtonInput).toBeChecked();
      });

      // the `appState.isSidebarDocked` should remain untouched when
      // `props.docked` is set to `false`, and user toggles
      // -------------------------------------------------------------------------

      act(() => {
        _setDocked(false);
        h.setState({ isSidebarDocked: true });
      });

      await waitFor(() => {
        expect(h.state.isSidebarDocked).toBe(true);
        expect(dockButtonInput).not.toBeChecked();
      });

      fireEvent.click(dockButtonInput);
      await waitFor(() => {
        expect(dockButtonInput).not.toBeChecked();
        expect(h.state.isSidebarDocked).toBe(true);
      });
    });
  });

  it("should toggle sidebar using props.toggleMenu()", async () => {
    const { container } = await render(
      <Excalidraw
        renderSidebar={() => (
          <Sidebar name="test">
            <div id="test-sidebar-content">42</div>
          </Sidebar>
        )}
      />,
    );

    // sidebar isn't rendered initially
    // -------------------------------------------------------------------------
    await waitFor(() => {
      const node = container.querySelector("#test-sidebar-content");
      expect(node).toBe(null);
    });

    // toggle sidebar on
    // -------------------------------------------------------------------------
    // expect(window.h.app.toggleMenu("customSidebar")).toBe(true);

    await waitFor(() => {
      const node = container.querySelector("#test-sidebar-content");
      expect(node).not.toBe(null);
    });

    // toggle sidebar off
    // -------------------------------------------------------------------------
    // expect(window.h.app.toggleMenu("customSidebar")).toBe(false);

    await waitFor(() => {
      const node = container.querySelector("#test-sidebar-content");
      expect(node).toBe(null);
    });

    // force-toggle sidebar off (=> still hidden)
    // -------------------------------------------------------------------------
    // expect(window.h.app.toggleMenu("customSidebar", false)).toBe(false);

    await waitFor(() => {
      const node = container.querySelector("#test-sidebar-content");
      expect(node).toBe(null);
    });

    // force-toggle sidebar on
    // -------------------------------------------------------------------------
    // expect(window.h.app.toggleMenu("customSidebar", true)).toBe(true);
    // expect(window.h.app.toggleMenu("customSidebar", true)).toBe(true);

    await waitFor(() => {
      const node = container.querySelector("#test-sidebar-content");
      expect(node).not.toBe(null);
    });

    // toggle library (= hide custom sidebar)
    // -------------------------------------------------------------------------
    // expect(window.h.app.toggleMenu("library")).toBe(true);

    await waitFor(() => {
      const node = container.querySelector("#test-sidebar-content");
      expect(node).toBe(null);

      // make sure only one sidebar is rendered
      const sidebars = container.querySelectorAll(".layer-ui__sidebar");
      expect(sidebars.length).toBe(1);
    });
  });
});
