import type React from "react";

import type { PointerDownState } from "../types";
import type App from "./App";

export class AppSelection {
  constructor(private readonly app: App) {}

  /**
   * @returns whether the pointer event has been completely handled and the
   * shared pointer move/up lifecycle should not be installed
   */
  handlePointerDown = (
    event: React.PointerEvent<HTMLElement>,
    pointerDownState: PointerDownState,
  ): boolean => {
    return this.app.handleSelectionOnPointerDown(event, pointerDownState);
  };
}
