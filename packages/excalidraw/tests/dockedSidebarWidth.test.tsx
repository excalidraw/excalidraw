// `UIOptions.dockedSidebarWidth` drives the `--right-sidebar-width` CSS variable
// (and the viewport offset reserved for the docked sidebar).
import { Excalidraw } from "../index";

import { render } from "./test-utils";

const sidebarWidthOf = (container: HTMLElement) =>
  (
    container.querySelector(".excalidraw") as HTMLElement
  ).style.getPropertyValue("--right-sidebar-width");

describe("UIOptions.dockedSidebarWidth", () => {
  it("keeps the native width when the option is absent", async () => {
    const { container } = await render(<Excalidraw />);
    expect(sidebarWidthOf(container)).toBe("302px");
  });

  it("applies the host width when the option is set", async () => {
    const { container } = await render(
      <Excalidraw UIOptions={{ dockedSidebarWidth: 320 }} />,
    );
    expect(sidebarWidthOf(container)).toBe("320px");
  });
});
