import { DEFAULT_LASER_COLOR, easeOut } from "@excalidraw/common";

import type { LaserPointerOptions } from "@excalidraw/laser-pointer";

import { AnimatedTrail } from "./animatedTrail";
import { getClientColor } from "./clients";

import type { Trail } from "./animatedTrail";
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

  // Tracks the exact moment the finger/pointer was lifted
  private localLiftTimestamp: number | null = null;
  private collabLiftTimestamps = new Map<SocketId, number | null>();

  private container?: SVGSVGElement;

  constructor(private app: App) {
    const settings = this.getLocalLaserSettings();
    this.localTrail = this.createTrail(settings, "local");
    this.localTrailSignature = this.getSettingsSignature(settings);
  }

  private isPointerDown(id: "local" | SocketId): boolean {
    if (id === "local") {
      return this.app.state.cursorButton === "down";
    }
    const collaborator = this.app.state.collaborators.get(id);
    return collaborator?.button === "down";
  }

  private getLiftTimestamp(id: "local" | SocketId): number | null {
    if (id === "local") {
      return this.localLiftTimestamp;
    }
    return this.collabLiftTimestamps.get(id) ?? null;
  }

  private setLiftTimestamp(id: "local" | SocketId, timestamp: number | null) {
    if (id === "local") {
      this.localLiftTimestamp = timestamp;
    } else if (timestamp === null) {
      this.collabLiftTimestamps.delete(id);
    } else {
      this.collabLiftTimestamps.set(id, timestamp);
    }
  }

  private createTrail(settings: LaserSettings, id: "local" | SocketId) {
    return new AnimatedTrail(this.app, {
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
          ? () => {
              // While finger is held down, stroke is 100% visible
              if (this.isPointerDown(id)) {
                return 1;
              }

              const liftTime = this.getLiftTimestamp(id);
              if (liftTime === null) {
                return 1;
              }

              const elapsed = performance.now() - liftTime;
              if (elapsed >= ACTIVE_FADE_MS) {
                return 0;
              }

              // Animate fade smoothly to 0
              return Math.max(0, 1 - elapsed / ACTIVE_FADE_MS);
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

  private isFadeComplete(trail: AnimatedTrail, id: "local" | SocketId) {
    if (this.isPointerDown(id)) {
      return false;
    }

    if (trail.hasCurrentTrail || !trail.hasAnyTrails()) {
      return false;
    }

    const liftTime = this.getLiftTimestamp(id);
    return liftTime !== null && performance.now() - liftTime >= ACTIVE_FADE_MS;
  }

  private ensureLocalTrail(settings: LaserSettings) {
    const signature = this.getSettingsSignature(settings);
    if (signature !== this.localTrailSignature) {
      this.localTrail.stop();
      this.localTrail = this.createTrail(settings, "local");
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

    const trail = this.createTrail(settings, key);
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

    // Laser pointer dot mode: immediately discard any old active/annotation trails
    if (settings.mode === "pointer") {
      this.clearLocalTrails();
      this.updatePointerDot("local", x, y, settings);
      return;
    }

    this.hidePointerDot("local");
    const trail = this.ensureLocalTrail(settings);

    if (settings.mode === "annotation") {
      const liftTime = this.getLiftTimestamp("local");

      // If previous fade completed, clear old trails before starting new stroke
      if (liftTime !== null && performance.now() - liftTime >= ACTIVE_FADE_MS) {
        trail.clearTrails();
      }

      // Resume stroke: cancel fade countdown and restore full visibility
      this.setLiftTimestamp("local", null);
      trail.refreshTrailTimestamps();
    }

    trail.startPath(x, y);
  }

  addPointToPath(x: number, y: number): void {
    const settings = this.getLocalLaserSettings();
    if (settings.mode === "pointer") {
      this.clearLocalTrails();
      this.updatePointerDot("local", x, y, settings);
      return;
    }

    this.hidePointerDot("local");
    const trail = this.ensureLocalTrail(settings);

    if (!trail.hasCurrentTrail) {
      this.startPath(x, y);
      return;
    }

    if (!trail.hasLastPoint(x, y)) {
      trail.addPointToPath(x, y);
    }

    if (settings.mode === "annotation") {
      this.setLiftTimestamp("local", null);
      trail.refreshTrailTimestamps();
    }
  }

  endPath(): void {
    // Instant removal for pointer dot mode on lift
    this.hidePointerDot("local");

    const settings = this.getLocalLaserSettings();
    if (settings.mode === "pointer") {
      this.clearLocalTrails();
      return;
    }

    const trail = this.ensureLocalTrail(settings);

    // Start fade-out timer on finger lift
    if (settings.mode === "annotation") {
      this.setLiftTimestamp("local", performance.now());
      trail.refreshTrailTimestamps();
    }

    trail.endPath();
  }

  clearLocalTrails() {
    this.setLiftTimestamp("local", null);
    this.localTrail.clearTrails();
  }

  hideLocalPointerDot() {
    this.hidePointerDot("local");
  }

  updatePointerPosition(x: number, y: number) {
    const settings = this.getLocalLaserSettings();
    if (settings.mode !== "pointer" || this.app.state.cursorButton !== "down") {
      this.hidePointerDot("local");
      return;
    }

    this.clearLocalTrails();
    this.updatePointerDot("local", x, y, settings);
  }

  start(container: SVGSVGElement) {
    this.container = container;
    this.localTrail.start(container);
  }

  stop() {
    this.localTrail.stop();
    this.stopCollabTrails();
    this.removePointerDot("local");
    for (const key of this.collabPointerDots.keys()) {
      this.removePointerDot(key);
    }
    this.setLiftTimestamp("local", null);
    this.collabLiftTimestamps.clear();
    this.container = undefined;
  }

  private stopCollabTrails(collaborators?: App["state"]["collaborators"]) {
    for (const [key, { trail }] of this.collabTrails.entries()) {
      const collaborator = collaborators?.get(key);
      if (!collaborator) {
        trail.stop();
        this.collabTrails.delete(key);
        this.removePointerDot(key);
        this.setLiftTimestamp(key, null);
      }
    }
  }

  updateCollabTrails(collaborators: App["state"]["collaborators"]) {
    this.stopCollabTrails(collaborators);

    // If local user is currently on pointer mode, purge any lingering strokes
    if (this.app.state.laserMode === "pointer") {
      this.clearLocalTrails();
    }

    // Keep active trails fully visible while user continues pressing
    if (
      this.app.state.activeTool.type === "laser" &&
      this.app.state.laserMode === "annotation" &&
      this.app.state.cursorButton === "down"
    ) {
      this.setLiftTimestamp("local", null);
      this.localTrail.refreshTrailTimestamps();
    }

    // Permanently remove faded annotation strokes once fade finishes
    if (
      this.app.state.laserMode === "annotation" &&
      this.app.state.cursorButton !== "down" &&
      this.isFadeComplete(this.localTrail, "local")
    ) {
      this.localTrail.clearTrails();
      this.setLiftTimestamp("local", null);
    }

    if (!this.container || collaborators.size === 0) {
      return;
    }

    for (const [key, collaborator] of collaborators.entries()) {
      if (collaborator.isCurrentUser) {
        continue;
      }

      if (collaborator.pointer && collaborator.pointer.tool === "laser") {
        const settings = this.getCollaboratorLaserSettings(key, collaborator);

        // Pointer mode: purge lingering collaborator strokes & instantly manage dot visibility
        if (settings.mode === "pointer") {
          this.setLiftTimestamp(key, null);
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

        const buttonDown = collaborator.button === "down";
        const buttonUp = collaborator.button === "up";

        if (buttonDown && !trail.hasCurrentTrail) {
          const liftTime = this.getLiftTimestamp(key);
          if (
            liftTime !== null &&
            performance.now() - liftTime >= ACTIVE_FADE_MS
          ) {
            trail.clearTrails();
          }
          this.setLiftTimestamp(key, null);
          trail.startPath(collaborator.pointer.x, collaborator.pointer.y);
        }

        if (
          buttonDown &&
          trail.hasCurrentTrail &&
          !trail.hasLastPoint(collaborator.pointer.x, collaborator.pointer.y)
        ) {
          trail.addPointToPath(collaborator.pointer.x, collaborator.pointer.y);
        }

        if (buttonDown && settings.mode === "annotation") {
          this.setLiftTimestamp(key, null);
          trail.refreshTrailTimestamps();
        }

        if (buttonUp && trail.hasCurrentTrail) {
          trail.addPointToPath(collaborator.pointer.x, collaborator.pointer.y);
          if (settings.mode === "annotation") {
            this.setLiftTimestamp(key, performance.now());
            trail.refreshTrailTimestamps();
          }
          trail.endPath();
        }

        // Permanently clear collaborator trails once fade is finished
        if (
          settings.mode === "annotation" &&
          collaborator.button !== "down" &&
          this.isFadeComplete(trail, key)
        ) {
          trail.clearTrails();
          this.setLiftTimestamp(key, null);
        }
      } else {
        this.hidePointerDot(key);
      }
    }
  }
}
