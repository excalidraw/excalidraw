import {
  isArrowKey,
  isInputLike,
  isWritableElement,
  KEYS,
} from "@excalidraw/common";

import { AnimationController, type AnimationKey } from "../renderer/animation";

import type App from "./App";

const BASE_SPEED = 900; // screen pixels per second
const SHIFT_MULTIPLIER = 2.5; // speed multiplier when holding Shift
const ACCEL_TIME_CONSTANT = 0.08; // seconds to ramp up velocity
const DECAY_TIME_CONSTANT = 0.12; // seconds to decay / fall off to a stop
const STOP_THRESHOLD = 0.5; // velocity threshold (screen px/s) to stop animation

export class AppKeyboardPan {
  private activeKeys = new Set<string>();
  private velocity = { x: 0, y: 0 };
  private isShiftHeld = false;
  private animationKey: AnimationKey = Symbol("keyboardPan");

  constructor(private app: App) {}

  public isNavigating(): boolean {
    return (
      this.activeKeys.size > 0 ||
      Math.hypot(this.velocity.x, this.velocity.y) > STOP_THRESHOLD
    );
  }

  private isViewMode(): boolean {
    return (
      this.app.state.viewModeEnabled ||
      (!this.app.isInteractionEnabled() && this.app.isNavigationEnabled())
    );
  }

  public handleKeyDown = (
    event: KeyboardEvent | React.KeyboardEvent,
  ): boolean => {
    if (!isArrowKey(event.key)) {
      return false;
    }

    if (!this.isViewMode()) {
      return false;
    }

    if (
      event[KEYS.CTRL_OR_CMD] ||
      event.altKey ||
      isWritableElement(event.target) ||
      isInputLike(event.target) ||
      this.app.state.openDialog ||
      this.app.state.openMenu
    ) {
      return false;
    }

    this.activeKeys.add(event.key);
    this.isShiftHeld = event.shiftKey;
    this.startAnimation();

    return true;
  };

  public handleKeyUp = (event: KeyboardEvent): void => {
    if (event.key === "Shift") {
      this.isShiftHeld = false;
    }

    if (isArrowKey(event.key)) {
      this.activeKeys.delete(event.key);
      this.isShiftHeld = event.shiftKey;
    }
  };

  public stop = (): void => {
    AnimationController.cancel(this.animationKey);
    this.activeKeys.clear();
    this.velocity.x = 0;
    this.velocity.y = 0;
  };

  private startAnimation = () => {
    if (AnimationController.running(this.animationKey)) {
      return;
    }

    AnimationController.start<{ active: boolean }>(
      this.animationKey,
      ({ deltaTime }) => {
        if (!this.isViewMode()) {
          this.stop();
          return null;
        }

        const dt = Math.min(deltaTime / 1000, 0.1);
        if (dt <= 0) {
          return { active: true };
        }

        let dirX = 0;
        let dirY = 0;

        if (this.activeKeys.has(KEYS.ARROW_LEFT)) {
          dirX += 1;
        }
        if (this.activeKeys.has(KEYS.ARROW_RIGHT)) {
          dirX -= 1;
        }
        if (this.activeKeys.has(KEYS.ARROW_UP)) {
          dirY += 1;
        }
        if (this.activeKeys.has(KEYS.ARROW_DOWN)) {
          dirY -= 1;
        }

        const len = Math.hypot(dirX, dirY);
        const speed = BASE_SPEED * (this.isShiftHeld ? SHIFT_MULTIPLIER : 1);
        const targetVx = len > 0 ? (dirX / len) * speed : 0;
        const targetVy = len > 0 ? (dirY / len) * speed : 0;

        // X-axis acceleration or decay
        if (targetVx !== 0) {
          const factorX = 1 - Math.exp(-dt / ACCEL_TIME_CONSTANT);
          this.velocity.x += (targetVx - this.velocity.x) * factorX;
        } else {
          const decayX = Math.exp(-dt / DECAY_TIME_CONSTANT);
          this.velocity.x *= decayX;
        }

        // Y-axis acceleration or decay
        if (targetVy !== 0) {
          const factorY = 1 - Math.exp(-dt / ACCEL_TIME_CONSTANT);
          this.velocity.y += (targetVy - this.velocity.y) * factorY;
        } else {
          const decayY = Math.exp(-dt / DECAY_TIME_CONSTANT);
          this.velocity.y *= decayY;
        }

        // Stop animation if keys are released and velocity has dropped below threshold
        if (
          len === 0 &&
          Math.hypot(this.velocity.x, this.velocity.y) < STOP_THRESHOLD
        ) {
          this.velocity.x = 0;
          this.velocity.y = 0;
          return null;
        }

        const dx = this.velocity.x * dt;
        const dy = this.velocity.y * dt;
        const zoom = this.app.state.zoom.value;

        this.app.viewport.translate((state) => ({
          scrollX: state.scrollX + dx / zoom,
          scrollY: state.scrollY + dy / zoom,
        }));

        return { active: true };
      },
      this.app.ownerWindow,
    );
  };
}
