import React from "react";
import { fireEvent, GlobalTestState, toggleMenu, render } from "./test-utils";
import { Excalidraw, Footer, MainMenu } from "../index";
import { queryByText, queryByTestId } from "@testing-library/react";
import { THEME } from "../constants";
import { t } from "../i18n";
import { useMemo } from "react";

const { h } = window;

describe("<Excalidraw/>", () => {
  afterEach(() => {
    const menu = document.querySelector(".dropdown-menu");
    if (menu) {
      toggleMenu(document.querySelector(".excalidraw")!);
    }
  });

  describe("Test zenModeEnabled prop", () => {
    it('should show exit zen mode button when zen mode is set and zen mode option in context menu when zenModeEnabled is "undefined"', async () => {
      const { container } = await render(<Excalidraw />);
      expect(
        container.getElementsByClassName("disable-zen-mode--visible").length,
      ).toBe(0);
      expect(h.state.zenModeEnabled).toBe(false);

      fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
        button: 2,
        clientX: 1,
        clientY: 1,
      });
      const contextMenu = document.querySelector(".context-menu");
      fireEvent.click(queryByText(contextMenu as HTMLElement, "Zen mode")!);
      expect(h.state.zenModeEnabled).toBe(true);
      expect(
        container.getElementsByClassName("disable-zen-mode--visible").length,
      ).toBe(1);
    });

    it("should not show exit zen mode button and zen mode option in context menu when zenModeEnabled is set", async () => {
      const { container } = await render(<Excalidraw zenModeEnabled={true} />);
      expect(
        container.getElementsByClassName("disable-zen-mode--visible").length,
      ).toBe(0);
      expect(h.state.zenModeEnabled).toBe(true);

      fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
        button: 2,
        clientX: 1,
        clientY: 1,
      });
      const contextMenu = document.querySelector(".context-menu");
      expect(queryByText(contextMenu as HTMLElement, "Zen mode")).toBe(null);
      expect(h.state.zenModeEnabled).toBe(true);
      expect(
        container.getElementsByClassName("disable-zen-mode--visible").length,
      ).toBe(0);
    });
  });

  it("should render the footer only when Footer is passed as children", async () => {
    //Footer not passed hence it will not render the footer
    let { container } = await render(
      <Excalidraw>
        <div>This is a custom footer</div>
      </Excalidraw>,
    );
    expect(container.querySelector(".footer-center")).toBe(null);

    // Footer passed hence it will render the footer
    ({ container } = await render(
      <Excalidraw>
        <Footer>
          <div>This is a custom footer</div>
        </Footer>
      </Excalidraw>,
    ));
    expect(container.querySelector(".footer-center")).toMatchInlineSnapshot(
      `
      <div
        class="footer-center zen-mode-transition"
      >
        <div>
          This is a custom footer
        </div>
      </div>
    `,
    );
  });

  describe("Test gridModeEnabled prop", () => {
    it('should show grid mode in context menu when gridModeEnabled is "undefined"', async () => {
      const { container } = await render(<Excalidraw />);
      expect(h.state.gridModeEnabled).toBe(false);

      expect(
        container.getElementsByClassName("disable-zen-mode--visible").length,
      ).toBe(0);
      fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
        button: 2,
        clientX: 1,
        clientY: 1,
      });
      const contextMenu = document.querySelector(".context-menu");
      fireEvent.click(queryByText(contextMenu as HTMLElement, "Toggle grid")!);
      expect(h.state.gridModeEnabled).toBe(true);
    });

    it('should not show grid mode in context menu when gridModeEnabled is not "undefined"', async () => {
      const { container } = await render(
        <Excalidraw gridModeEnabled={false} />,
      );
      expect(h.state.gridModeEnabled).toBe(false);

      expect(
        container.getElementsByClassName("disable-zen-mode--visible").length,
      ).toBe(0);
      fireEvent.contextMenu(GlobalTestState.interactiveCanvas, {
        button: 2,
        clientX: 1,
        clientY: 1,
      });
      const contextMenu = document.querySelector(".context-menu");
      expect(queryByText(contextMenu as HTMLElement, "Show grid")).toBe(null);
      expect(h.state.gridModeEnabled).toBe(false);
    });
  });

  describe("Test UIOptions prop", () => {
    describe("Test canvasActions", () => {
      it('should render menu with default items when "UIOPtions" is "undefined"', async () => {
        const { container } = await render(
          <Excalidraw UIOptions={undefined} />,
        );
        //open menu
        toggleMenu(container);
        expect(queryByTestId(container, "dropdown-menu")).toMatchSnapshot();
      });

      it("should hide clear canvas button when clearCanvas is false", async () => {
        const { container } = await render(
          <Excalidraw UIOptions={{ canvasActions: { clearCanvas: false } }} />,
        );
        //open menu
        toggleMenu(container);
        expect(queryByTestId(container, "clear-canvas-button")).toBeNull();
      });

      it("should hide export button when export is false", async () => {
        const { container } = await render(
          <Excalidraw UIOptions={{ canvasActions: { export: false } }} />,
        );
        //open menu
        toggleMenu(container);
        expect(queryByTestId(container, "json-export-button")).toBeNull();
      });

      it("should hide 'Save as image' button when 'saveAsImage' is false", async () => {
        const { container } = await render(
          <Excalidraw UIOptions={{ canvasActions: { saveAsImage: false } }} />,
        );
        //open menu
        toggleMenu(container);
        expect(queryByTestId(container, "image-export-button")).toBeNull();
      });

      it("should hide load button when loadScene is false", async () => {
        const { container } = await render(
          <Excalidraw UIOptions={{ canvasActions: { loadScene: false } }} />,
        );

        expect(queryByTestId(container, "load-button")).toBeNull();
      });

      it("should hide save as button when saveFileToDisk is false", async () => {
        const { container } = await render(
          <Excalidraw
            UIOptions={{ canvasActions: { export: { saveFileToDisk: false } } }}
          />,
        );
        //open menu
        toggleMenu(container);
        expect(queryByTestId(container, "save-as-button")).toBeNull();
      });

      it("should hide save button when saveToActiveFile is false", async () => {
        const { container } = await render(
          <Excalidraw
            UIOptions={{ canvasActions: { saveToActiveFile: false } }}
          />,
        );
        //open menu
        toggleMenu(container);
        expect(queryByTestId(container, "save-button")).toBeNull();
      });

      it("should hide the canvas background picker when changeViewBackgroundColor is false", async () => {
        const { container } = await render(
          <Excalidraw
            UIOptions={{ canvasActions: { changeViewBackgroundColor: false } }}
          />,
        );
        //open menu
        toggleMenu(container);
        expect(queryByTestId(container, "canvas-background-label")).toBeNull();
        expect(queryByTestId(container, "canvas-background-picker")).toBeNull();
      });

      it("should hide the canvas background picker even if passed if the `canvasActions.changeViewBackgroundColor` is set to false", async () => {
        const { container } = await render(
          <Excalidraw
            UIOptions={{ canvasActions: { changeViewBackgroundColor: false } }}
          >
            <MainMenu>
              <MainMenu.DefaultItems.ChangeCanvasBackground />
            </MainMenu>
          </Excalidraw>,
        );
        //open menu
        toggleMenu(container);
        expect(queryByTestId(container, "canvas-background-label")).toBeNull();
        expect(queryByTestId(container, "canvas-background-picker")).toBeNull();
      });

      it("should hide the theme toggle when theme is false", async () => {
        const { container } = await render(
          <Excalidraw UIOptions={{ canvasActions: { toggleTheme: false } }} />,
        );
        //open menu
        toggleMenu(container);
        expect(queryByTestId(container, "toggle-dark-mode")).toBeNull();
      });

      it("should not render default items in custom menu even if passed if the prop in `canvasActions` is set to false", async () => {
        const { container } = await render(
          <Excalidraw UIOptions={{ canvasActions: { loadScene: false } }}>
            <MainMenu>
              <MainMenu.ItemCustom>
                <button
                  style={{ height: "2rem" }}
                  onClick={() => window.alert("custom menu item")}
                >
                  custom item
                </button>
              </MainMenu.ItemCustom>
              <MainMenu.DefaultItems.LoadScene />
            </MainMenu>
          </Excalidraw>,
        );
        //open menu
        toggleMenu(container);
        // load button shouldn't be rendered since `UIActions.canvasActions.loadScene` is `false`
        expect(queryByTestId(container, "load-button")).toBeNull();
      });
    });
  });

  describe("Test theme prop", () => {
    it("should show the theme toggle by default", async () => {
      const { container } = await render(<Excalidraw />);
      expect(h.state.theme).toBe(THEME.LIGHT);
      //open menu
      toggleMenu(container);
      const darkModeToggle = queryByTestId(container, "toggle-dark-mode");
      expect(darkModeToggle).toBeTruthy();
    });

    it("should not show theme toggle when the theme prop is defined", async () => {
      const { container } = await render(<Excalidraw theme={THEME.DARK} />);

      expect(h.state.theme).toBe(THEME.DARK);
      //open menu
      toggleMenu(container);
      expect(queryByTestId(container, "toggle-dark-mode")).toBe(null);
    });

    it("should show theme mode toggle when `UIOptions.canvasActions.toggleTheme` is true", async () => {
      const { container } = await render(
        <Excalidraw
          theme={THEME.DARK}
          UIOptions={{ canvasActions: { toggleTheme: true } }}
        />,
      );
      expect(h.state.theme).toBe(THEME.DARK);
      //open menu
      toggleMenu(container);
      const darkModeToggle = queryByTestId(container, "toggle-dark-mode");
      expect(darkModeToggle).toBeTruthy();
    });

    it("should not show theme toggle when `UIOptions.canvasActions.toggleTheme` is false", async () => {
      const { container } = await render(
        <Excalidraw
          UIOptions={{ canvasActions: { toggleTheme: false } }}
          theme={THEME.DARK}
        />,
      );
      expect(h.state.theme).toBe(THEME.DARK);
      //open menu
      toggleMenu(container);
      const darkModeToggle = queryByTestId(container, "toggle-dark-mode");
      expect(darkModeToggle).toBe(null);
    });
  });

  describe("Test name prop", () => {
    it("should allow editing name", async () => {
      const { container } = await render(<Excalidraw />);
      //open menu
      toggleMenu(container);
      fireEvent.click(queryByTestId(container, "image-export-button")!);
      const textInput: HTMLInputElement | null = document.querySelector(
        ".ImageExportModal .ImageExportModal__preview__filename .TextInput",
      );
      expect(textInput?.value).toContain(`${t("labels.untitled")}`);
      expect(textInput?.nodeName).toBe("INPUT");
    });

    it('should set the name when the name prop is present"', async () => {
      const name = "test";
      const { container } = await render(<Excalidraw name={name} />);
      //open menu
      toggleMenu(container);
      await fireEvent.click(queryByTestId(container, "image-export-button")!);
      const textInput = document.querySelector(
        ".ImageExportModal .ImageExportModal__preview__filename .TextInput",
      ) as HTMLInputElement;
      expect(textInput?.value).toEqual(name);
      expect(textInput?.nodeName).toBe("INPUT");
    });
  });

  describe("Test autoFocus prop", () => {
    it("should not focus when autoFocus is false", async () => {
      const { container } = await render(<Excalidraw />);

      expect(
        container.querySelector(".excalidraw") === document.activeElement,
      ).toBe(false);
    });

    it("should focus when autoFocus is true", async () => {
      const { container } = await render(<Excalidraw autoFocus={true} />);

      expect(
        container.querySelector(".excalidraw") === document.activeElement,
      ).toBe(true);
    });
  });

  describe("<MainMenu/>", () => {
    it("should render main menu with host menu items if passed from host", async () => {
      const { container } = await render(
        <Excalidraw>
          <MainMenu>
            <MainMenu.Item onSelect={() => window.alert("Clicked")}>
              Click me
            </MainMenu.Item>
            <MainMenu.ItemLink href="blog.excalidaw.com">
              Excalidraw blog
            </MainMenu.ItemLink>
            <MainMenu.ItemCustom>
              <button
                style={{ height: "2rem" }}
                onClick={() => window.alert("custom menu item")}
              >
                custom menu item
              </button>
            </MainMenu.ItemCustom>
            <MainMenu.DefaultItems.Help />
          </MainMenu>
        </Excalidraw>,
      );
      //open menu
      toggleMenu(container);
      expect(queryByTestId(container, "dropdown-menu")).toMatchSnapshot();
    });

    it("should update themeToggle text even if MainMenu memoized", async () => {
      const CustomExcalidraw = () => {
        const customMenu = useMemo(() => {
          return (
            <MainMenu>
              <MainMenu.DefaultItems.ToggleTheme />
            </MainMenu>
          );
        }, []);

        return <Excalidraw>{customMenu}</Excalidraw>;
      };

      const { container } = await render(<CustomExcalidraw />);
      //open menu
      toggleMenu(container);

      expect(h.state.theme).toBe(THEME.LIGHT);

      expect(
        queryByTestId(container, "toggle-dark-mode")?.textContent,
      ).toContain(t("buttons.darkMode"));

      fireEvent.click(queryByTestId(container, "toggle-dark-mode")!);

      expect(
        queryByTestId(container, "toggle-dark-mode")?.textContent,
      ).toContain(t("buttons.lightMode"));
    });
  });
});
