import React from "react";
import { DEFAULT_SIDEBAR } from "../../constants";
import { Excalidraw, Sidebar } from "../../packages/excalidraw/index";
import {
  act,
  fireEvent,
  GlobalTestState,
  queryAllByTestId,
  queryByTestId,
  render,
  waitFor,
  withExcalidrawDimensions,
} from "../../tests/test-utils";

export const assertSidebarDockButton = async <T extends boolean>(
  hasDockButton: T,
): Promise<
  T extends false
    ? { dockButton: null; sidebar: HTMLElement }
    : { dockButton: HTMLElement; sidebar: HTMLElement }
> => {
  return await waitFor(() => {
    const sidebar =
      GlobalTestState.renderResult.container.querySelector<HTMLElement>(
        ".test-sidebar",
      );
    expect(sidebar).not.toBe(null);
    const dockButton = queryByTestId(sidebar!, "sidebar-dock");
    if (hasDockButton) {
      expect(dockButton).not.toBe(null);
      return { dockButton: dockButton!, sidebar: sidebar! } as any;
    }
    expect(dockButton).toBe(null);
    return { dockButton: null, sidebar: sidebar! } as any;
  });
};

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
    const onStateChange = jest.fn();
    const CustomExcalidraw = () => {
      return (
        <Excalidraw
          initialData={{ appState: { openSidebar: { name: "customSidebar" } } }}
        >
          <Sidebar
            name="customSidebar"
            className="test-sidebar"
            onStateChange={onStateChange}
          >
            <Sidebar.Header />
            hello
          </Sidebar>
        </Excalidraw>
      );
    };

    const { container } = await render(<CustomExcalidraw />);

    // initial open
    expect(onStateChange).toHaveBeenCalledWith({ name: "customSidebar" });

    const sidebar = container.querySelector<HTMLElement>(".test-sidebar");
    expect(sidebar).not.toBe(null);
    const closeButton = queryByTestId(sidebar!, "sidebar-close")!;
    expect(closeButton).not.toBe(null);

    fireEvent.click(closeButton);
    await waitFor(() => {
      expect(container.querySelector<HTMLElement>(".test-sidebar")).toBe(null);
      expect(onStateChange).toHaveBeenCalledWith(null);
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

    await render(<CustomExcalidraw />);

    // should show dock button when the sidebar fits to be docked
    // -------------------------------------------------------------------------

    await assertSidebarDockButton(false);
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

    await render(<CustomExcalidraw />);

    // should show dock button when the sidebar fits to be docked
    // -------------------------------------------------------------------------

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      await assertSidebarDockButton(true);
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
            onDock={dockable ? () => {} : undefined}
          >
            <Sidebar.Header />
            hello
          </Sidebar>
        </Excalidraw>
      );
    };

    await render(<CustomExcalidraw />);

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      // should not show dock button when `dockable` is `false`
      // -------------------------------------------------------------------------

      act(() => {
        _setDockable(false);
      });

      await assertSidebarDockButton(false);

      // should show dock button when `dockable` is `true`, even if `docked`
      // prop is set
      // -------------------------------------------------------------------------

      act(() => {
        _setDockable(true);
      });

      await assertSidebarDockButton(true);
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
