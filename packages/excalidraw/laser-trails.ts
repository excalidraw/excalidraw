import { DEFAULT_LASER_COLOR, easeOut } from "@excalidraw/common";

import type { LaserPointerOptions } from "@excalidraw/laser-pointer";

import { AnimatedTrail } from "./animated-trail";
import { getClientColor } from "./clients";

import type { Trail } from "./animated-trail";
import type { AnimationFrameHandler } from "./animation-frame-handler";
import type App from "./components/App";
import type { Collaborator, LaserMode, SocketId } from "./types";

type LaserSettings = {
  mode: LaserMode;
  thickness: number;
  neon: boolean;
  color: string;
};

type TrailEntry = {
  trail: AnimatedTrail;
  signature: string;
};

const ACTIVE_FADE_MS = 1200;

export class LaserTrails implements Trail {
  public localTrail: AnimatedTrail;
  private localTrailSignature = "";
  private collabTrails = new Map<SocketId, TrailEntry>();
  private localPointerDot?: SVGCircleElement;
  private collabPointerDots = new Map<SocketId, SVGCircleElement>();

  private container?: SVGSVGElement;

  constructor(
    private animationFrameHandler: AnimationFrameHandler,
    private app: App,
  ) {
    this.animationFrameHandler.register(this, this.onFrame.bind(this));

    this.localTrail = this.createTrail(this.getLocalLaserSettings());
    this.localTrailSignature = this.getSettingsSignature(
      this.getLocalLaserSettings(),
    );
  }

  private createTrail(settings: LaserSettings) {
    return new AnimatedTrail(this.animationFrameHandler, this.app, {
      ...this.getTrailOptions(settings),
      fill: () => settings.color,
      stroke: settings.neon ? () => "rgba(255, 255, 255, 0.9)" : undefined,
      strokeWidth: settings.neon ? 1 : undefined,
      filter: settings.neon
        ? () =>
            `drop-shadow(0 0 2px rgba(255,255,255,0.65)) drop-shadow(0 0 4px ${settings.color})`
        : undefined,
      opacity:
        settings.mode === "annotation"
          ? (trail) => {
              const latestPointTimestamp = trail.getLatestPointTimestamp();
              if (!latestPointTimestamp) {
                return 1;
              }
              return (
                1 - (performance.now() - latestPointTimestamp) / ACTIVE_FADE_MS
              );
            }
          : undefined,
    });
  }

  private getTrailOptions(settings: LaserSettings) {
    const holdModeSizeMapping = (pointData: {
      pressure: number;
      totalLength: number;
      currentIndex: number;
    }) => {
      const decayTimeMs = 1000;
      const decayLength = 50;
      const timeFadeFactor = Math.max(
        0,
        1 - (performance.now() - pointData.pressure) / decayTimeMs,
      );
      const tailFadeFactor =
        (decayLength -
          Math.min(
            decayLength,
            pointData.totalLength - pointData.currentIndex,
          )) /
        decayLength;

      return Math.min(easeOut(tailFadeFactor), easeOut(timeFadeFactor));
    };

    const sizeMapping =
      settings.mode === "annotation" ? () => 1 : holdModeSizeMapping;

    return {
      simplify: 0,
      streamline: 0.4,
      size: settings.thickness,
      sizeMapping,
    } as Partial<LaserPointerOptions>;
  }

  private getLocalLaserSettings(): LaserSettings {
    const state = this.app.state;
    return {
      mode: state?.laserMode ?? "hold",
      thickness: this.clampThickness(state?.laserThickness),
      neon: state?.laserNeon ?? true,
      color: DEFAULT_LASER_COLOR,
    };
  }

  private getCollaboratorLaserSettings(
    key: SocketId,
    collaborator: Collaborator,
  ): LaserSettings {
    return {
      mode: collaborator.pointer?.laserMode || "hold",
      thickness: this.clampThickness(collaborator.pointer?.laserThickness),
      neon: collaborator.pointer?.laserNeon ?? true,
      color:
        collaborator.pointer?.laserColor || getClientColor(key, collaborator),
    };
  }

  private clampThickness(value: number | undefined) {
    return Math.max(1, Math.min(10, value ?? 2));
  }

  private getSettingsSignature(settings: LaserSettings) {
    return `${settings.mode}:${settings.thickness}:${settings.neon}:${settings.color}`;
  }

  private shouldRemoveActiveTrail(trail: AnimatedTrail) {
    if (trail.hasCurrentTrail || !trail.hasAnyTrails()) {
      return false;
    }
    const latestPointTimestamp = trail.getLatestPointTimestamp();
    return (
      !!latestPointTimestamp &&
      performance.now() - latestPointTimestamp >= ACTIVE_FADE_MS
    );
  }

  private ensureLocalTrail(settings: LaserSettings) {
    const signature = this.getSettingsSignature(settings);
    if (signature !== this.localTrailSignature) {
      this.localTrail.stop();
      this.localTrail = this.createTrail(settings);
      if (this.container) {
        this.localTrail.start(this.container);
      }
      this.localTrailSignature = signature;
    }
    return this.localTrail;
  }

  private ensureCollaboratorTrail(
    key: SocketId,
    settings: LaserSettings,
  ): AnimatedTrail | null {
    if (!this.container) {
      return null;
    }

    const signature = this.getSettingsSignature(settings);
    const existing = this.collabTrails.get(key);

    if (existing?.signature === signature) {
      return existing.trail;
    }

    existing?.trail.stop();

    const trail = this.createTrail(settings);
    trail.start(this.container);
    this.collabTrails.set(key, { trail, signature });

    return trail;
  }

  private ensurePointerDot(id: "local" | SocketId) {
    if (!this.container) {
      return null;
    }

    if (id === "local" && this.localPointerDot) {
      return this.localPointerDot;
    }

    if (id !== "local") {
      const collabDot = this.collabPointerDots.get(id);
      if (collabDot) {
        return collabDot;
      }
    }

    const dot = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    dot.setAttribute("r", "4");
    dot.style.display = "none";

    this.container.appendChild(dot);

    if (id === "local") {
      this.localPointerDot = dot;
    } else {
      this.collabPointerDots.set(id, dot);
    }

    return dot;
  }

  private removePointerDot(id: "local" | SocketId) {
    if (id === "local") {
      this.localPointerDot?.remove();
      this.localPointerDot = undefined;
      return;
    }

    this.collabPointerDots.get(id)?.remove();
    this.collabPointerDots.delete(id);
  }

  private updatePointerDot(
    id: "local" | SocketId,
    x: number,
    y: number,
    settings: LaserSettings,
  ) {
    const dot = this.ensurePointerDot(id);
    if (!dot) {
      return;
    }

    dot.setAttribute("cx", String(x));
    dot.setAttribute("cy", String(y));
    dot.setAttribute("r", String(Math.max(2, settings.thickness / 2 + 1)));
    dot.setAttribute("fill", settings.color);
    if (settings.neon) {
      dot.setAttribute("stroke", "rgba(255, 255, 255, 0.9)");
      dot.setAttribute("stroke-width", "1");
      dot.style.filter = `drop-shadow(0 0 2px rgba(255,255,255,0.65)) drop-shadow(0 0 4px ${settings.color})`;
    } else {
      dot.removeAttribute("stroke");
      dot.removeAttribute("stroke-width");
      dot.style.removeProperty("filter");
    }
    dot.style.display = "";
  }

  private hidePointerDot(id: "local" | SocketId) {
    if (id === "local") {
      if (this.localPointerDot) {
        this.localPointerDot.style.display = "none";
      }
      return;
    }
    const dot = this.collabPointerDots.get(id);
    if (dot) {
      dot.style.display = "none";
    }
  }

  startPath(x: number, y: number): void {
    const settings = this.getLocalLaserSettings();
    if (settings.mode === "pointer") {
      this.updatePointerDot("local", x, y, settings);
      return;
    }

    this.hidePointerDot("local");
    const trail = this.ensureLocalTrail(settings);
    if (settings.mode === "annotation") {
      trail.refreshTrailTimestamps();
    }
    trail.startPath(x, y);
  }

  addPointToPath(x: number, y: number): void {
    const settings = this.getLocalLaserSettings();
    if (settings.mode === "pointer") {
      this.updatePointerDot("local", x, y, settings);
      return;
    }

    this.hidePointerDot("local");
    const trail = this.ensureLocalTrail(settings);
    if (!trail.hasCurrentTrail) {
      trail.startPath(x, y);
      return;
    }

    if (!trail.hasLastPoint(x, y)) {
      trail.addPointToPath(x, y);
    }

    if (settings.mode === "annotation") {
      trail.refreshTrailTimestamps();
    }
  }

  endPath(): void {
    const settings = this.getLocalLaserSettings();
    if (settings.mode === "pointer") {
      return;
    }

    const trail = this.ensureLocalTrail(settings);
    trail.endPath();
  }

  clearLocalTrails() {
    this.localTrail.clearTrails();
  }

  hideLocalPointerDot() {
    this.hidePointerDot("local");
  }

  updatePointerPosition(x: number, y: number) {
    const settings = this.getLocalLaserSettings();
    if (settings.mode !== "pointer") {
      this.hidePointerDot("local");
      return;
    }

    if (this.app.state.cursorButton !== "down") {
      this.hidePointerDot("local");
      return;
    }

    this.updatePointerDot("local", x, y, settings);
  }

  start(container: SVGSVGElement) {
    this.container = container;

    this.animationFrameHandler.start(this);
    this.localTrail.start(container);
  }

  stop() {
    this.animationFrameHandler.stop(this);
    this.localTrail.stop();

    for (const { trail } of this.collabTrails.values()) {
      trail.stop();
    }
    this.collabTrails.clear();

    this.removePointerDot("local");
    for (const key of this.collabPointerDots.keys()) {
      this.removePointerDot(key);
    }
  }

  onFrame() {
    if (
      this.app.state.activeTool.type === "laser" &&
      this.app.state.laserMode === "annotation" &&
      this.app.state.cursorButton === "down"
    ) {
      // Keep all local active trails fully visible while pointer is held,
      // even if the cursor is not moving.
      this.localTrail.refreshTrailTimestamps();
    }

    if (
      this.app.state.laserMode === "annotation" &&
      this.app.state.cursorButton !== "down" &&
      this.shouldRemoveActiveTrail(this.localTrail)
    ) {
      this.localTrail.clearTrails();
    }

    this.updateCollabTrails();
  }

  private updateCollabTrails() {
    if (!this.container || this.app.state.collaborators.size === 0) {
      return;
    }

    for (const [key, collaborator] of this.app.state.collaborators.entries()) {
      if (collaborator.pointer && collaborator.pointer.tool === "laser") {
        const settings = this.getCollaboratorLaserSettings(key, collaborator);

        if (settings.mode === "pointer") {
          this.collabTrails.get(key)?.trail.clearTrails();
          if (collaborator.button === "down") {
            this.updatePointerDot(
              key,
              collaborator.pointer.x,
              collaborator.pointer.y,
              settings,
            );
          } else {
            this.hidePointerDot(key);
          }
          continue;
        }

        this.hidePointerDot(key);

        const trail = this.ensureCollaboratorTrail(key, settings);
        if (!trail) {
          continue;
        }

        if (collaborator.button === "down" && !trail.hasCurrentTrail) {
          trail.startPath(collaborator.pointer.x, collaborator.pointer.y);
        }

        if (
          collaborator.button === "down" &&
          trail.hasCurrentTrail &&
          !trail.hasLastPoint(collaborator.pointer.x, collaborator.pointer.y)
        ) {
          trail.addPointToPath(collaborator.pointer.x, collaborator.pointer.y);
        }

        if (collaborator.button === "down" && settings.mode === "annotation") {
          trail.refreshTrailTimestamps();
        }

        if (collaborator.button === "up" && trail.hasCurrentTrail) {
          trail.addPointToPath(collaborator.pointer.x, collaborator.pointer.y);
          trail.endPath();
        }

        if (
          settings.mode === "annotation" &&
          collaborator.button !== "down" &&
          this.shouldRemoveActiveTrail(trail)
        ) {
          trail.clearTrails();
        }
      } else {
        this.hidePointerDot(key);
      }
    }

    for (const [key, { trail }] of this.collabTrails.entries()) {
      if (this.app.state.collaborators.has(key)) {
        continue;
      }

      trail.stop();
      this.collabTrails.delete(key);
      this.removePointerDot(key);
    }

    for (const key of this.collabPointerDots.keys()) {
      if (!this.app.state.collaborators.has(key)) {
        this.removePointerDot(key);
      }
    }
  }
}
