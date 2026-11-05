import React from "react";

import { KEYS } from "@excalidraw/common";

import { act, render as vanillaRender } from "@testing-library/react";

import { defaultLang, setLanguage } from "../../i18n";
import { Excalidraw, MainMenu } from "../../index";
import { Keyboard } from "../../tests/helpers/ui";
import {
  render,
  waitFor,
  getByTestId,
  fireEvent,
} from "../../tests/test-utils";

import DropdownMenu from "./DropdownMenu";

describe("Test <DropdownMenu/>", () => {
  it("closes on Escape", async () => {
    const { container } = await render(<Excalidraw />);

    expect(window.h.state.openMenu).toBe(null);

    fireEvent.click(getByTestId(container, "main-menu-trigger"));
    expect(window.h.state.openMenu).toBe("canvas");

    await waitFor(() => {
      Keyboard.keyDown(KEYS.ESCAPE);
      expect(window.h.state.openMenu).toBe(null);
    });
  });

  it.each([
    ["main menu", '[data-testid="main-menu-trigger"]'],
    ["more tools", ".App-toolbar__extra-tools-trigger"],
  ])(
    "closes %s on outside pointer and touch events after reopening",
    async (_, triggerSelector) => {
      const { container } = await render(<Excalidraw />);
      const trigger = container.querySelector<HTMLElement>(triggerSelector)!;
      const canvas = container.querySelector<HTMLCanvasElement>("canvas")!;
      const toolbar = getByTestId(container, "toolbar-rectangle");

      for (const outsideTarget of [canvas, toolbar]) {
        for (const event of [fireEvent.pointerDown, fireEvent.touchStart]) {
          fireEvent.click(trigger);
          await waitFor(() => {
            expect(
              container.querySelector('[data-testid="dropdown-menu"]'),
            ).not.toBeNull();
          });

          event(outsideTarget);
          await waitFor(() => {
            expect(
              container.querySelector('[data-testid="dropdown-menu"]'),
            ).toBeNull();
          });
        }
      }
    },
  );

  describe("RTL submenu and menu direction", () => {
    afterEach(async () => {
      await act(async () => {
        await setLanguage(defaultLang);
      });
    });

    it("renders dropdown menu with dir='ltr' in default mode and dir='rtl' in RTL mode", async () => {
      const { container } = await render(
        <Excalidraw>
          <MainMenu>
            <MainMenu.DefaultItems.Preferences />
          </MainMenu>
        </Excalidraw>,
      );

      // Default (LTR) mode
      fireEvent.click(getByTestId(container, "main-menu-trigger"));
      await waitFor(() => {
        const menu = container.querySelector('[data-testid="dropdown-menu"]');
        expect(menu).not.toBeNull();
        expect(menu?.getAttribute("dir")).toBe("ltr");
      });

      // Submenu trigger chevron icon has rtl-mirror class
      const submenuTriggerIcon = container.querySelector(
        ".dropdown-menu__submenu-trigger-icon",
      );
      expect(submenuTriggerIcon).not.toBeNull();
      expect(submenuTriggerIcon?.classList.contains("rtl-mirror")).toBe(true);

      // Close menu
      Keyboard.keyDown(KEYS.ESCAPE);

      // Switch to RTL mode (Hebrew)
      await act(async () => {
        await setLanguage({ code: "he-IL", label: "עברית", rtl: true });
      });

      fireEvent.click(getByTestId(container, "main-menu-trigger"));
      await waitFor(() => {
        const menu = container.querySelector('[data-testid="dropdown-menu"]');
        expect(menu).not.toBeNull();
        expect(menu?.getAttribute("dir")).toBe("rtl");
      });
    });

    it("propagates dir='rtl' to submenu content in RTL mode", async () => {
      await act(async () => {
        await setLanguage({ code: "he-IL", label: "עברית", rtl: true });
      });

      vanillaRender(
        <DropdownMenu open={true}>
          <DropdownMenu.Trigger onToggle={() => {}}>
            Trigger
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Sub open={true}>
              <DropdownMenu.Sub.Trigger>Sub Trigger</DropdownMenu.Sub.Trigger>
              <DropdownMenu.Sub.Content className="test-rtl-submenu-content">
                Sub Content
              </DropdownMenu.Sub.Content>
            </DropdownMenu.Sub>
          </DropdownMenu.Content>
        </DropdownMenu>,
      );

      await waitFor(() => {
        const submenuContent = document.querySelector(
          ".test-rtl-submenu-content",
        );
        expect(submenuContent).not.toBeNull();
        expect(submenuContent?.getAttribute("dir")).toBe("rtl");
      });
    });

    it("propagates dir='ltr' to submenu content in LTR mode", async () => {
      vanillaRender(
        <DropdownMenu open={true}>
          <DropdownMenu.Trigger onToggle={() => {}}>
            Trigger
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Sub open={true}>
              <DropdownMenu.Sub.Trigger>Sub Trigger</DropdownMenu.Sub.Trigger>
              <DropdownMenu.Sub.Content className="test-ltr-submenu-content">
                Sub Content
              </DropdownMenu.Sub.Content>
            </DropdownMenu.Sub>
          </DropdownMenu.Content>
        </DropdownMenu>,
      );

      await waitFor(() => {
        const submenuContent = document.querySelector(
          ".test-ltr-submenu-content",
        );
        expect(submenuContent).not.toBeNull();
        expect(submenuContent?.getAttribute("dir")).toBe("ltr");
      });
    });

    it("computes spaceRemaining using parentRect.left in RTL mode to prevent overlap", async () => {
      await act(async () => {
        await setLanguage({ code: "he-IL", label: "עברית", rtl: true });
      });

      const originalGBCR = Element.prototype.getBoundingClientRect;
      try {
        Element.prototype.getBoundingClientRect = function () {
          if (this.classList?.contains("dropdown-menu-container")) {
            // Main menu is on the right of the viewport:
            // parentRect.left = 700, parentRect.right = 950
            return {
              left: 700,
              right: 950,
              top: 100,
              bottom: 400,
              width: 250,
              height: 300,
              x: 700,
              y: 100,
              toJSON: () => {},
            };
          }
          if (this.classList?.contains("test-rtl-offset-content")) {
            return {
              left: 0,
              right: 200,
              top: 100,
              bottom: 300,
              width: 200,
              height: 200,
              x: 0,
              y: 100,
              toJSON: () => {},
            };
          }
          return originalGBCR.apply(this);
        };

        vanillaRender(
          <DropdownMenu open={true}>
            <DropdownMenu.Trigger onToggle={() => {}}>
              Trigger
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Sub open={true}>
                <DropdownMenu.Sub.Trigger>Sub Trigger</DropdownMenu.Sub.Trigger>
                <DropdownMenu.Sub.Content className="test-rtl-offset-content">
                  Sub Content
                </DropdownMenu.Sub.Content>
              </DropdownMenu.Sub>
            </DropdownMenu.Content>
          </DropdownMenu>,
        );

        await waitFor(() => {
          const submenuContent = document.querySelector(
            ".test-rtl-offset-content",
          );
          expect(submenuContent).not.toBeNull();
          expect(submenuContent?.getAttribute("dir")).toBe("rtl");
        });
      } finally {
        Element.prototype.getBoundingClientRect = originalGBCR;
      }
    });
  });
});
