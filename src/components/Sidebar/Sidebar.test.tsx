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
  GlobalTestState,
  queryAllByTestId,
  queryByTestId,
  render,
  waitFor,
  withExcalidrawDimensions,
} from "../../tests/test-utils";

const assertSidebarDockButton = async <T extends boolean>(
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
            onDock={dockable ? () => {} : undefined}
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

  it("DefaultSidebar should require passing both `onDock` and `docked` to be dockable", async () => {
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
        expect(sidebar).toHaveClass("layer-ui__sidebar--docked");
      });

      fireEvent.click(dockButton);
      await waitFor(() => {
        expect(h.state.defaultSidebarDockedPreference).toBe(false);
        expect(dockButton).not.toHaveClass("selected");
        expect(sidebar).not.toHaveClass("layer-ui__sidebar--docked");
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
    // but keep sidebar docked
    // -------------------------------------------------------------------------
    act(() => {
      _setDocked(true);
    });

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      expect(h.state.defaultSidebarDockedPreference).toBe(false);

      const { sidebar } = await assertSidebarDockButton(false);
      expect(sidebar).toHaveClass("layer-ui__sidebar--docked");
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
