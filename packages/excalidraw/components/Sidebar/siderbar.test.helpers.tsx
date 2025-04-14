import React from "react";

import { Excalidraw } from "../..";
import {
  GlobalTestState,
  queryByTestId,
  render,
  withExcalidrawDimensions,
} from "../../tests/test-utils";

export const assertSidebarDockButton = async <T extends boolean>(
  hasDockButton: T,
): Promise<
  T extends false
    ? { dockButton: null; sidebar: HTMLElement }
    : { dockButton: HTMLElement; sidebar: HTMLElement }
> => {
  const sidebar =
    GlobalTestState.renderResult.container.querySelector<HTMLElement>(
      ".sidebar",
    );
  expect(sidebar).not.toBe(null);
  const dockButton = queryByTestId(sidebar!, "sidebar-dock");
  if (hasDockButton) {
    expect(dockButton).not.toBe(null);
    return { dockButton: dockButton!, sidebar: sidebar! } as any;
  }
  expect(dockButton).toBe(null);
  return { dockButton: null, sidebar: sidebar! } as any;
};

export const assertExcalidrawWithSidebar = async (
  sidebar: React.ReactNode,
  name: string,
  test: () => void,
) => {
  await render(
    <Excalidraw initialData={{ appState: { openSidebar: { name } } }}>
      {sidebar}
    </Excalidraw>,
  );
  await withExcalidrawDimensions({ width: 1920, height: 1080 }, test);
};
