import React from "react";
import { DEFAULT_SIDEBAR } from "../../constants";
import { Excalidraw, Sidebar } from "../../index";
import {
  act,
  fireEvent,
  queryAllByTestId,
  queryByTestId,
  render,
  waitFor,
  withExcalidrawDimensions,
} from "../../tests/test-utils";
import { vi } from "vitest";
import {
  assertExcalidrawWithSidebar,
  assertSidebarDockButton,
} from "./siderbar.test.helpers";

const toggleSidebar = (
  ...args: Parameters<typeof window.h.app.toggleSidebar>
): Promise<boolean> => {
  return act(() => {
    return window.h.app.toggleSidebar(...args);
  });
};

describe("Sidebar", () => {
  describe("General behavior", () => {
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
        const sidebars = container.querySelectorAll(".sidebar");
        expect(sidebars.length).toBe(1);
      });
    });

    it("should toggle sidebar using excalidrawAPI.toggleSidebar()", async () => {
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
      expect(await toggleSidebar({ name: "customSidebar" })).toBe(true);

      await waitFor(() => {
        const node = container.querySelector("#test-sidebar-content");
        expect(node).not.toBe(null);
      });

      // toggle sidebar off
      // -------------------------------------------------------------------------
      expect(await toggleSidebar({ name: "customSidebar" })).toBe(false);

      await waitFor(() => {
        const node = container.querySelector("#test-sidebar-content");
        expect(node).toBe(null);
      });

      // force-toggle sidebar off (=> still hidden)
      // -------------------------------------------------------------------------
      expect(await toggleSidebar({ name: "customSidebar", force: false })).toBe(
        false,
      );

      await waitFor(() => {
        const node = container.querySelector("#test-sidebar-content");
        expect(node).toBe(null);
      });

      // force-toggle sidebar on
      // -------------------------------------------------------------------------
      expect(await toggleSidebar({ name: "customSidebar", force: true })).toBe(
        true,
      );
      expect(await toggleSidebar({ name: "customSidebar", force: true })).toBe(
        true,
      );

      await waitFor(() => {
        const node = container.querySelector("#test-sidebar-content");
        expect(node).not.toBe(null);
      });

      // toggle library (= hide custom sidebar)
      // -------------------------------------------------------------------------
      expect(await toggleSidebar({ name: DEFAULT_SIDEBAR.name })).toBe(true);

      await waitFor(() => {
        const node = container.querySelector("#test-sidebar-content");
        expect(node).toBe(null);

        // make sure only one sidebar is rendered
        const sidebars = container.querySelectorAll(".sidebar");
        expect(sidebars.length).toBe(1);
      });

      // closing sidebar using `{ name: null }`
      // -------------------------------------------------------------------------
      expect(await toggleSidebar({ name: "customSidebar" })).toBe(true);
      await waitFor(() => {
        const node = container.querySelector("#test-sidebar-content");
        expect(node).not.toBe(null);
      });

      expect(await toggleSidebar({ name: null })).toBe(false);
      await waitFor(() => {
        const node = container.querySelector("#test-sidebar-content");
        expect(node).toBe(null);
      });
    });
  });

  describe("<Sidebar.Header/>", () => {
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

    it("should not render <Sidebar.Header> for custom sidebars by default", async () => {
      const CustomExcalidraw = () => {
        return (
          <Excalidraw
            initialData={{
              appState: { openSidebar: { name: "customSidebar" } },
            }}
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
      const onStateChange = vi.fn();
      const CustomExcalidraw = () => {
        return (
          <Excalidraw
            initialData={{
              appState: { openSidebar: { name: "customSidebar" } },
            }}
          >
            <Sidebar
              name="customSidebar"
              className="test-sidebar"
              onStateChange={onStateChange}
            >
              <Sidebar.Header />
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
        expect(container.querySelector<HTMLElement>(".test-sidebar")).toBe(
          null,
        );
        expect(onStateChange).toHaveBeenCalledWith(null);
      });
    });
  });

  describe("Docking behavior", () => {
    it("shouldn't be user-dockable if `onDock` not supplied", async () => {
      await assertExcalidrawWithSidebar(
        <Sidebar name="customSidebar">
          <Sidebar.Header />
        </Sidebar>,
        "customSidebar",
        async () => {
          await assertSidebarDockButton(false);
        },
      );
    });

    it("shouldn't be user-dockable if `onDock` not supplied & `docked={true}`", async () => {
      await assertExcalidrawWithSidebar(
        <Sidebar name="customSidebar" docked={true}>
          <Sidebar.Header />
        </Sidebar>,
        "customSidebar",
        async () => {
          await assertSidebarDockButton(false);
        },
      );
    });

    it("shouldn't be user-dockable if `onDock` not supplied & docked={false}`", async () => {
      await assertExcalidrawWithSidebar(
        <Sidebar name="customSidebar" docked={false}>
          <Sidebar.Header />
        </Sidebar>,
        "customSidebar",
        async () => {
          await assertSidebarDockButton(false);
        },
      );
    });

    it("should be user-dockable when both `onDock` and `docked` supplied", async () => {
      await render(
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
          </Sidebar>
        </Excalidraw>,
      );

      await withExcalidrawDimensions(
        { width: 1920, height: 1080 },
        async () => {
          await assertSidebarDockButton(true);
        },
      );
    });

    it("shouldn't be user-dockable when only `onDock` supplied w/o `docked`", async () => {
      // we expect warnings in this test and don't want to pollute stdout
      const mock = jest.spyOn(console, "warn").mockImplementation(() => {});

      await render(
        <Excalidraw
          initialData={{ appState: { openSidebar: { name: "customSidebar" } } }}
        >
          <Sidebar
            name="customSidebar"
            className="test-sidebar"
            onDock={() => {}}
          >
            <Sidebar.Header />
          </Sidebar>
        </Excalidraw>,
      );

      await withExcalidrawDimensions(
        { width: 1920, height: 1080 },
        async () => {
          await assertSidebarDockButton(false);
        },
      );

      mock.mockRestore();
    });
  });

  describe("Sidebar.tab", () => {
    it("should toggle sidebars tabs correctly", async () => {
      const { container } = await render(
        <Excalidraw>
          <Sidebar name="custom" docked>
            <Sidebar.Tabs>
              <Sidebar.Tab tab="library">Library</Sidebar.Tab>
              <Sidebar.Tab tab="comments">Comments</Sidebar.Tab>
            </Sidebar.Tabs>
          </Sidebar>
        </Excalidraw>,
      );

      await withExcalidrawDimensions(
        { width: 1920, height: 1080 },
        async () => {
          expect(
            container.querySelector<HTMLElement>(
              "[role=tabpanel][data-testid=library]",
            ),
          ).toBeNull();

          // open library sidebar
          expect(await toggleSidebar({ name: "custom", tab: "library" })).toBe(
            true,
          );
          expect(
            container.querySelector<HTMLElement>(
              "[role=tabpanel][data-testid=library]",
            ),
          ).not.toBeNull();

          // switch to comments tab
          expect(await toggleSidebar({ name: "custom", tab: "comments" })).toBe(
            true,
          );
          expect(
            container.querySelector<HTMLElement>(
              "[role=tabpanel][data-testid=comments]",
            ),
          ).not.toBeNull();

          // toggle sidebar closed
          expect(await toggleSidebar({ name: "custom", tab: "comments" })).toBe(
            false,
          );
          expect(
            container.querySelector<HTMLElement>(
              "[role=tabpanel][data-testid=comments]",
            ),
          ).toBeNull();

          // toggle sidebar open
          expect(await toggleSidebar({ name: "custom", tab: "comments" })).toBe(
            true,
          );
          expect(
            container.querySelector<HTMLElement>(
              "[role=tabpanel][data-testid=comments]",
            ),
          ).not.toBeNull();
        },
      );
    });
  });
});
