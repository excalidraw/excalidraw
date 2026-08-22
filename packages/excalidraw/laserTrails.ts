import { DEFAULT_LASER_COLOR, easeOut } from "@excalidraw/common";

import type { LaserPointerOptions } from "@excalidraw/laser-pointer";

import { AnimatedTrail } from "./animatedTrail";
import { getClientColor } from "./clients";

import type { Trail } from "./animatedTrail";
import type App from "./components/App";
import type { SocketId } from "./types";

export class LaserTrails implements Trail {
  public localTrail: AnimatedTrail;
  private collabTrails = new Map<
    SocketId,
    {
      trail: AnimatedTrail;
      persistent: { value: boolean };
      generation: number;
    }
  >();
  private container?: SVGSVGElement;
  private localGeneration = 0;

  constructor(private app: App) {
    this.localTrail = new AnimatedTrail(app, {
      ...this.getTrailOptions(() => this.app.state.laserPersistent),
      fill: () => DEFAULT_LASER_COLOR,
    });
  }

  private getTrailOptions(isPersistent: () => boolean) {
    return {
      simplify: 0,
      streamline: 0.4,
      keepTrailAlive: isPersistent,
      sizeMapping: (c) => {
        if (isPersistent()) {
          return 1;
        }

        const DECAY_TIME = 1000;
        const DECAY_LENGTH = 50;
        const t = Math.max(
          0,
          1 - (performance.now() - c.pressure) / DECAY_TIME,
        );
        const l =
          (DECAY_LENGTH -
            Math.min(DECAY_LENGTH, c.totalLength - c.currentIndex)) /
          DECAY_LENGTH;

        return Math.min(easeOut(l), easeOut(t));
      },
    } as Partial<LaserPointerOptions> & {
      keepTrailAlive: () => boolean;
    };
  }

  get generation() {
    return this.localGeneration;
  }

  clearLocalTrails() {
    this.localGeneration++;
    this.localTrail.clearTrails();
  }

  refresh() {
    this.localTrail.refresh();
    for (const { trail } of this.collabTrails.values()) {
      trail.refresh();
    }
  }

  startPath(x: number, y: number): void {
    this.localTrail.startPath(x, y);
  }

  addPointToPath(x: number, y: number): void {
    this.localTrail.addPointToPath(x, y);
  }

  endPath(): void {
    this.localTrail.endPath();
  }

  start(container: SVGSVGElement) {
    this.container = container;
    this.localTrail.start(container);
  }

  stop() {
    this.localTrail.stop();
    this.stopCollabTrails();
    this.container = undefined;
  }

  private stopCollabTrails(collaborators?: App["state"]["collaborators"]) {
    for (const [key, { trail }] of this.collabTrails) {
      const collaborator = collaborators?.get(key);

      if (!collaborator) {
        trail.stop();
        this.collabTrails.delete(key);
      }
    }
  }

  updateCollabTrails(collaborators: App["state"]["collaborators"]) {
    this.stopCollabTrails(collaborators);

    if (!this.container || collaborators.size === 0) {
      return;
    }

    for (const [key, collaborator] of collaborators.entries()) {
      // Current user has their own trail drawn via localTrail
      if (collaborator.isCurrentUser) {
        continue;
      }

      // IDEA: Use the collaborator pointer coordinates to trace out the
      // laser pointer trail when 1) the selected collab tool is the laser
      // pointer and 2) the collab pointer button is in the "down" state.
      let trailState = this.collabTrails.get(key);
      if (!trailState) {
        const persistent = {
          value: !!collaborator.pointer?.laserPersistent,
        };
        const trail = new AnimatedTrail(this.app, {
          ...this.getTrailOptions(() => persistent.value),
          fill: () =>
            collaborator.pointer?.laserColor ||
            getClientColor(key, collaborator),
        });
        trailState = {
          persistent,
          generation: collaborator.pointer?.laserTrailGeneration ?? 0,
          trail,
        };
        trail.start(this.container);

        this.collabTrails.set(key, trailState);
      }

      const trail = trailState.trail;
      const persistent = !!collaborator.pointer?.laserPersistent;
      const generation = collaborator.pointer?.laserTrailGeneration ?? 0;

      if (
        generation !== trailState.generation ||
        trailState.persistent.value !== persistent ||
        collaborator.pointer?.tool !== "laser"
      ) {
        trail.clearTrails();
      }
      trailState.generation = generation;
      trailState.persistent.value = persistent;

      if (collaborator.pointer && collaborator.pointer.tool === "laser") {
        const buttonDown = collaborator.button === "down";
        const buttonUp = collaborator.button === "up";
        const hasTrail = trail.hasCurrentTrail;

        // Initialize a new trail
        if (buttonDown && !hasTrail) {
          trail.startPath(collaborator.pointer.x, collaborator.pointer.y);
        }

        // Add only original points
        const lastPointOriginal = !trail.hasLastPoint(
          collaborator.pointer.x,
          collaborator.pointer.y,
        );
        if (buttonDown && lastPointOriginal) {
          trail.addPointToPath(collaborator.pointer.x, collaborator.pointer.y);
        }

        // End the trail on button up
        if (buttonUp && hasTrail) {
          trail.addPointToPath(collaborator.pointer.x, collaborator.pointer.y);
          trail.endPath();
        }
      }
    }
  }
}
