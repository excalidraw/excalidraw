import React from "react";
import { DEFAULT_SIDEBAR } from "../../constants";
import {
  DefaultSidebar,
  Excalidraw,
  Sidebar,
} from "../../packages/excalidraw/index";
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
      >
        <Sidebar name="customSidebar">
          <div id="test-sidebar-content">42</div>
        </Sidebar>
      </Excalidraw>,
    );

    const node = container.querySelector("#test-sidebar-content");
    expect(node).not.toBe(null);
  });

  it("should render custom sidebar header", async () => {
    const { container } = await render(
      <Excalidraw
        initialData={{ appState: { openSidebar: { name: "customSidebar" } } }}
      >
        <Sidebar name="customSidebar">
          <Sidebar.Header>
            <div id="test-sidebar-header-content">42</div>
          </Sidebar.Header>
        </Sidebar>
      </Excalidraw>,
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
      >
        <Sidebar name="customSidebar">
          <div id="test-sidebar-content">42</div>
        </Sidebar>
      </Excalidraw>,
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

  it("should not render <Sidebar.Header> for custom sidebars by default", async () => {
    const CustomExcalidraw = () => {
      return (
        <Excalidraw
          initialData={{ appState: { openSidebar: { name: "customSidebar" } } }}
        >
          <Sidebar name="customSidebar" className="test-sidebar">
            hello
          </Sidebar>
        </Excalidraw>
      );
    };

    const { container } = await render(<CustomExcalidraw />);

    const sidebar = container.querySelector<HTMLElement>(".test-sidebar");
    expect(sidebar).not.toBe(null);
    const closeButton = queryByTestId(sidebar!, "sidebar-close");
    expect(closeButton).toBe(null);
  });

  it("<Sidebar.Header> should render close button", async () => {
    const onToggle = jest.fn();
    const CustomExcalidraw = () => {
      return (
        <Excalidraw
          initialData={{ appState: { openSidebar: { name: "customSidebar" } } }}
        >
          <Sidebar
            name="customSidebar"
            className="test-sidebar"
            onToggle={onToggle}
          >
            <Sidebar.Header />
            hello
          </Sidebar>
        </Excalidraw>
      );
    };

    const { container } = await render(<CustomExcalidraw />);

    // initial open
    expect(onToggle).toHaveBeenCalledWith(true);

    const sidebar = container.querySelector<HTMLElement>(".test-sidebar");
    expect(sidebar).not.toBe(null);
    const closeButton = queryByTestId(sidebar!, "sidebar-close")!;
    expect(closeButton).not.toBe(null);

    fireEvent.click(closeButton);
    await waitFor(() => {
      expect(container.querySelector<HTMLElement>(".test-sidebar")).toBe(null);
      expect(onToggle).toHaveBeenCalledWith(false);
    });
  });

  it("should render custom sidebar without dock button if onDock not supplied", async () => {
    const CustomExcalidraw = () => {
      return (
        <Excalidraw
          initialData={{ appState: { openSidebar: { name: "customSidebar" } } }}
        >
          <Sidebar name="customSidebar" className="test-sidebar">
            <Sidebar.Header />
            hello
          </Sidebar>
        </Excalidraw>
      );
    };

    const { container } = await render(<CustomExcalidraw />);

    // should show dock button when the sidebar fits to be docked
    // -------------------------------------------------------------------------

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, () => {
      const sidebar = container.querySelector<HTMLElement>(".test-sidebar");
      expect(sidebar).not.toBe(null);
      const closeButton = queryByTestId(sidebar!, "sidebar-dock");
      expect(closeButton).toBe(null);
    });
  });

  it("should render custom sidebar with dock button if onDock supplied", async () => {
    const CustomExcalidraw = () => {
      return (
        <Excalidraw
          initialData={{ appState: { openSidebar: { name: "customSidebar" } } }}
        >
          <Sidebar
            name="customSidebar"
            className="test-sidebar"
            onDock={() => {}}
            docked
          >
            <Sidebar.Header />
            hello
          </Sidebar>
        </Excalidraw>
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
  });

  it("should support controlled docking", async () => {
    let _setDockable: (dockable: boolean) => void = null!;

    const CustomExcalidraw = () => {
      const [dockable, setDockable] = React.useState(false);
      _setDockable = setDockable;
      return (
        <Excalidraw
          initialData={{ appState: { openSidebar: { name: "customSidebar" } } }}
        >
          <Sidebar
            name="customSidebar"
            className="test-sidebar"
            docked={false}
            dockable={dockable}
            onDock={() => {}}
          >
            <Sidebar.Header />
            hello
          </Sidebar>
        </Excalidraw>
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
          const dockBotton = queryByTestId(sidebar!, "sidebar-dock");
          expect(dockBotton).not.toBe(null);
          return dockBotton!;
        });

        const dockButtonInput = dockButton.querySelector("input")!;

        fireEvent.click(dockButtonInput);
        await waitFor(() => {
          expect(h.state.defaultSidebarDockedPreference).toBe(true);
          expect(dockButtonInput).toBeChecked();
        });

        fireEvent.click(dockButtonInput);
        await waitFor(() => {
          expect(h.state.defaultSidebarDockedPreference).toBe(false);
          expect(dockButtonInput).not.toBeChecked();
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

        const dockBotton = queryByTestId(sidebar!, "sidebar-dock");
        expect(dockBotton).toBe(null);

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

        const dockBotton = queryByTestId(sidebar!, "sidebar-dock");
        expect(dockBotton).toBe(null);

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
          const dockBotton = queryByTestId(sidebar!, "sidebar-dock");
          expect(dockBotton).not.toBe(null);
          return dockBotton!;
        });

        const dockButtonInput = dockButton.querySelector("input")!;

        fireEvent.click(dockButtonInput);
        await waitFor(() => {
          expect(h.state.defaultSidebarDockedPreference).toBe(true);
          expect(dockButtonInput).toBeChecked();
        });

        fireEvent.click(dockButtonInput);
        await waitFor(() => {
          expect(h.state.defaultSidebarDockedPreference).toBe(false);
          expect(dockButtonInput).not.toBeChecked();
        });
      }
    });
  });

  it("should toggle sidebar using props.toggleMenu()", async () => {
    const { container } = await render(
      <Excalidraw>
        <Sidebar name="customSidebar">
          <div id="test-sidebar-content">42</div>
        </Sidebar>
      </Excalidraw>,
    );

    // sidebar isn't rendered initially
    // -------------------------------------------------------------------------
    await waitFor(() => {
      const node = container.querySelector("#test-sidebar-content");
      expect(node).toBe(null);
    });

    // toggle sidebar on
    // -------------------------------------------------------------------------
    expect(window.h.app.toggleSidebar({ name: "customSidebar" })).toBe(true);

    await waitFor(() => {
      const node = container.querySelector("#test-sidebar-content");
      expect(node).not.toBe(null);
    });

    // toggle sidebar off
    // -------------------------------------------------------------------------
    expect(window.h.app.toggleSidebar({ name: "customSidebar" })).toBe(false);

    await waitFor(() => {
      const node = container.querySelector("#test-sidebar-content");
      expect(node).toBe(null);
    });

    // force-toggle sidebar off (=> still hidden)
    // -------------------------------------------------------------------------
    expect(
      window.h.app.toggleSidebar({ name: "customSidebar", force: false }),
    ).toBe(false);

    await waitFor(() => {
      const node = container.querySelector("#test-sidebar-content");
      expect(node).toBe(null);
    });

    // force-toggle sidebar on
    // -------------------------------------------------------------------------
    expect(
      window.h.app.toggleSidebar({ name: "customSidebar", force: true }),
    ).toBe(true);
    expect(
      window.h.app.toggleSidebar({ name: "customSidebar", force: true }),
    ).toBe(true);

    await waitFor(() => {
      const node = container.querySelector("#test-sidebar-content");
      expect(node).not.toBe(null);
    });

    // toggle library (= hide custom sidebar)
    // -------------------------------------------------------------------------
    expect(window.h.app.toggleSidebar({ name: DEFAULT_SIDEBAR.name })).toBe(
      true,
    );

    await waitFor(() => {
      const node = container.querySelector("#test-sidebar-content");
      expect(node).toBe(null);

      // make sure only one sidebar is rendered
      const sidebars = container.querySelectorAll(".layer-ui__sidebar");
      expect(sidebars.length).toBe(1);
    });
  });
});
