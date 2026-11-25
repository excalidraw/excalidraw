import { toBrandedType, UserIdleState } from "@excalidraw/common";

import type {
  Collaborator,
  ExcalidrawImperativeAPI,
  SocketId,
} from "@excalidraw/excalidraw/types";

import { getAppWindow } from "./aiAgentSettings";

export const AI_AGENT_SOCKET_ID = toBrandedType<SocketId>(
  "ai-agent-collaborator",
);

const easeInOutCubic = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

export class AgentCursorController {
  private api: ExcalidrawImperativeAPI;
  private getOwnerWindow: () => Window;
  private currentX: number = 0;
  private currentY: number = 0;
  private currentTool: "pointer" | "laser" = "pointer";
  private currentButton: "up" | "down" = "up";
  private selectedElementIds: Record<string, true> = {};
  private activeRafId: number | null = null;
  private activeResolve: (() => void) | null = null;
  private pendingTimers = new Set<number>();
  private isVisible: boolean = true;
  private isDestroyed: boolean = false;

  constructor(api: ExcalidrawImperativeAPI, getOwnerWindow?: () => Window) {
    this.api = api;
    this.getOwnerWindow = getOwnerWindow || (() => getAppWindow());
    this.initializePosition();
  }

  private get ownerWindow(): Window {
    return this.getOwnerWindow();
  }

  private initializePosition() {
    const appState = this.api.getAppState();
    const zoom = appState.zoom.value || 1;
    // Start slightly inside top-right of current viewport in scene coordinates
    this.currentX = -appState.scrollX + (appState.width * 0.8) / zoom;
    this.currentY = -appState.scrollY + (appState.height * 0.25) / zoom;
  }

  private cancelActiveAnimation() {
    if (this.activeRafId !== null) {
      this.ownerWindow.cancelAnimationFrame(this.activeRafId);
      this.activeRafId = null;
    }
    if (this.activeResolve) {
      const resolve = this.activeResolve;
      this.activeResolve = null;
      resolve();
    }
  }

  private clearPendingTimers() {
    for (const timerId of this.pendingTimers) {
      this.ownerWindow.clearTimeout(timerId);
    }
    this.pendingTimers.clear();
  }

  public scheduleTimeout(callback: () => void, delayMs: number): number {
    const timerId = this.ownerWindow.setTimeout(() => {
      this.pendingTimers.delete(timerId);
      if (!this.isDestroyed) {
        callback();
      }
    }, delayMs);
    this.pendingTimers.add(timerId);
    return timerId;
  }

  public setVisible(visible: boolean) {
    if (this.isDestroyed) {
      return;
    }
    this.isVisible = visible;
    if (!visible) {
      this.removeFromScene();
    } else {
      this.syncCollaborator();
    }
  }

  public getPosition(): { x: number; y: number } {
    return { x: this.currentX, y: this.currentY };
  }

  private buildCollaborator(): Collaborator {
    return {
      id: "ai-agent-collaborator",
      socketId: AI_AGENT_SOCKET_ID,
      username: "AI Agent",
      color: {
        background: "#8b5cf6",
        stroke: "#6d28d9",
      },
      pointer: {
        x: this.currentX,
        y: this.currentY,
        tool: this.currentTool,
        renderCursor: true,
        laserColor: "#8b5cf6",
      },
      button: this.currentButton,
      selectedElementIds: { ...this.selectedElementIds },
      userState: UserIdleState.ACTIVE,
    };
  }

  public syncCollaborator() {
    if (!this.isVisible || this.isDestroyed) {
      return;
    }

    const currentCollaborators = new Map(this.api.getAppState().collaborators);
    currentCollaborators.set(AI_AGENT_SOCKET_ID, this.buildCollaborator());
    this.api.updateScene({ collaborators: currentCollaborators });
  }

  public removeFromScene() {
    this.cancelActiveAnimation();
    this.clearPendingTimers();

    const currentCollaborators = new Map(this.api.getAppState().collaborators);
    if (currentCollaborators.has(AI_AGENT_SOCKET_ID)) {
      currentCollaborators.delete(AI_AGENT_SOCKET_ID);
      this.api.updateScene({ collaborators: currentCollaborators });
    }
  }

  /**
   * Smoothly moves the AI cursor from its current position to (targetX, targetY).
   */
  public animateMoveTo(
    targetX: number,
    targetY: number,
    durationMs: number = 400,
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isVisible || this.isDestroyed) {
        this.currentX = targetX;
        this.currentY = targetY;
        resolve();
        return;
      }

      this.cancelActiveAnimation();

      const startX = this.currentX;
      const startY = this.currentY;
      const startTime = this.ownerWindow.performance.now();
      this.activeResolve = resolve;

      const step = (now: number) => {
        if (this.isDestroyed || !this.isVisible) {
          this.cancelActiveAnimation();
          return;
        }

        const elapsed = now - startTime;
        const rawProgress = Math.min(elapsed / Math.max(durationMs, 1), 1);
        const progress = easeInOutCubic(rawProgress);

        this.currentX = startX + (targetX - startX) * progress;
        this.currentY = startY + (targetY - startY) * progress;
        this.syncCollaborator();

        if (rawProgress < 1) {
          this.activeRafId = this.ownerWindow.requestAnimationFrame(step);
        } else {
          this.activeRafId = null;
          const finish = this.activeResolve;
          this.activeResolve = null;
          finish?.();
        }
      };

      this.activeRafId = this.ownerWindow.requestAnimationFrame(step);
    });
  }

  /**
   * Animates a live drawing gesture across a series of points (e.g. bounding box or contour)
   * using laser tool and button down, leaving visual drawing traces.
   */
  public async animateDrawingGesture(
    points: Array<{ x: number; y: number }>,
    durationMs: number = 800,
  ): Promise<void> {
    if (!this.isVisible || this.isDestroyed || points.length === 0) {
      return;
    }

    // Move to first point
    await this.animateMoveTo(points[0].x, points[0].y, 250);
    if (!this.isVisible || this.isDestroyed) {
      return;
    }

    // Switch to laser and button down
    this.currentTool = "laser";
    this.currentButton = "down";
    this.syncCollaborator();

    const totalSegments = points.length - 1;
    const timePerSegment =
      totalSegments > 0 ? durationMs / totalSegments : durationMs;

    for (let i = 1; i < points.length; i++) {
      if (!this.isVisible || this.isDestroyed) {
        break;
      }
      await this.animateMoveTo(points[i].x, points[i].y, timePerSegment);
    }

    // Finish gesture
    this.currentTool = "pointer";
    this.currentButton = "up";
    this.syncCollaborator();
  }

  /**
   * Selects newly created elements with collaborator highlight
   */
  public selectElements(elementIds: string[]) {
    this.selectedElementIds = elementIds.reduce((acc, id) => {
      acc[id] = true;
      return acc;
    }, {} as Record<string, true>);
    this.syncCollaborator();
  }

  public clearSelection() {
    this.selectedElementIds = {};
    this.syncCollaborator();
  }

  public destroy() {
    this.isDestroyed = true;
    this.removeFromScene();
  }
}
