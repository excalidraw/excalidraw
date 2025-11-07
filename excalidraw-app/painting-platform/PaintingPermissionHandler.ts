/**
 * PaintingPermissionHandler - Enforces region-based drawing permissions
 *
 * Integrates with Excalidraw's drawing system to restrict users to their claimed regions
 */

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";
import { RegionManager } from "./RegionManager";
import type { UserId } from "./types";

/**
 * Handles permission checking for drawing operations
 */
export class PaintingPermissionHandler {
  private regionManager: RegionManager;
  private currentUserId: UserId;
  private enabled: boolean;

  constructor(regionManager: RegionManager, currentUserId: UserId) {
    this.regionManager = regionManager;
    this.currentUserId = currentUserId;
    this.enabled = true;
  }

  /**
   * Enable/disable permission checking
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if user can create an element at given position
   */
  canCreateElement(x: number, y: number): boolean {
    if (!this.enabled) {
      return true;
    }

    return this.regionManager.canUserDrawAtPoint(this.currentUserId, {
      x,
      y,
    });
  }

  /**
   * Check if user can modify an existing element
   */
  canModifyElement(element: ExcalidrawElement): boolean {
    if (!this.enabled) {
      return true;
    }

    // Check if element is within user's regions
    const centerX = element.x + element.width / 2;
    const centerY = element.y + element.height / 2;

    return this.regionManager.canUserDrawAtPoint(this.currentUserId, {
      x: centerX,
      y: centerY,
    });
  }

  /**
   * Check if user can delete an element
   */
  canDeleteElement(element: ExcalidrawElement): boolean {
    // Same rules as modification
    return this.canModifyElement(element);
  }

  /**
   * Validate a freedraw element against region boundaries
   * Returns true if all points are within user's claimable regions
   */
  validateFreeDrawElement(element: ExcalidrawElement): boolean {
    if (!this.enabled) {
      return true;
    }

    if (element.type !== "freedraw") {
      return this.canModifyElement(element);
    }

    // For freedraw, check multiple points along the path
    // This is a simplified check - a full implementation would check all points
    const points = (element as any).points || [];

    if (points.length === 0) {
      return this.canCreateElement(element.x, element.y);
    }

    // Check first, middle, and last points
    const checkPoints = [
      { x: element.x + points[0][0], y: element.y + points[0][1] },
      {
        x: element.x + points[Math.floor(points.length / 2)][0],
        y: element.y + points[Math.floor(points.length / 2)][1],
      },
      {
        x: element.x + points[points.length - 1][0],
        y: element.y + points[points.length - 1][1],
      },
    ];

    // All checked points must be in user's regions
    return checkPoints.every((point) =>
      this.regionManager.canUserDrawAtPoint(this.currentUserId, point),
    );
  }

  /**
   * Get visual feedback for invalid drawing location
   */
  getInvalidDrawingFeedback(x: number, y: number): string | null {
    if (!this.enabled) {
      return null;
    }

    const region = this.regionManager.findRegionAtPoint({ x, y });

    if (!region) {
      return "No region defined here. Please select a region first.";
    }

    if (region.locked) {
      return "This region is locked and cannot be modified.";
    }

    if (region.claimedBy && region.claimedBy !== this.currentUserId) {
      return `This region is claimed by another user.`;
    }

    if (!region.claimedBy) {
      return "This region is not claimed. Claim it first to draw here.";
    }

    return null;
  }

  /**
   * Filter elements that user can see/interact with
   */
  filterVisibleElements(elements: ExcalidrawElement[]): ExcalidrawElement[] {
    if (!this.enabled) {
      return elements;
    }

    // For now, all elements are visible (transparency/privacy features can be added later)
    return elements;
  }

  /**
   * Get the current user's drawable regions
   */
  getUserDrawableRegions() {
    return this.regionManager.getUserRegions(this.currentUserId);
  }

  /**
   * Check if user can use a specific tool in their current context
   */
  canUseTool(
    tool: string,
    appState: Partial<AppState>,
  ): { allowed: boolean; reason?: string } {
    if (!this.enabled) {
      return { allowed: true };
    }

    // Check if user has any claimed regions
    const userRegions = this.getUserDrawableRegions();

    if (userRegions.length === 0) {
      return {
        allowed: false,
        reason: "Please claim a region before drawing.",
      };
    }

    // All drawing tools are allowed if user has regions
    const drawingTools = [
      "freedraw",
      "rectangle",
      "diamond",
      "ellipse",
      "arrow",
      "line",
      "text",
    ];

    if (drawingTools.includes(tool)) {
      return { allowed: true };
    }

    // Selection and other non-drawing tools are always allowed
    return { allowed: true };
  }

  /**
   * Set current user ID (for switching perspectives)
   */
  setCurrentUser(userId: UserId): void {
    this.currentUserId = userId;
  }

  /**
   * Get current user ID
   */
  getCurrentUser(): UserId {
    return this.currentUserId;
  }
}

/**
 * Create a permission handler for a session
 */
export function createPermissionHandler(
  regionManager: RegionManager,
  userId: UserId,
): PaintingPermissionHandler {
  return new PaintingPermissionHandler(regionManager, userId);
}
