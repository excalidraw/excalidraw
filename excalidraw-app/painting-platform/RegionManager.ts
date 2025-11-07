/**
 * RegionManager - Handles canvas region creation, claiming, and validation
 */

import type {
  CanvasRegion,
  RegionId,
  UserId,
  PaintingSession,
  CanvasPermissions,
} from "./types";

/**
 * Manages canvas regions for collaborative painting sessions
 */
export class RegionManager {
  private regions: Map<RegionId, CanvasRegion>;
  private session: PaintingSession;

  constructor(session: PaintingSession) {
    this.session = session;
    this.regions = new Map(
      session.regions.map((region) => [region.id, region]),
    );
  }

  /**
   * Generate a unique region ID
   */
  private generateRegionId(): RegionId {
    return `region_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new region from polygon points
   */
  createRegion(
    points: Array<{ x: number; y: number }>,
    style?: CanvasRegion["style"],
  ): CanvasRegion {
    // Validate polygon
    if (points.length < 3) {
      throw new Error("Region must have at least 3 points");
    }

    const region: CanvasRegion = {
      id: this.generateRegionId(),
      points: [...points], // Clone points
      claimedBy: null,
      claimedAt: null,
      locked: false,
      style: style || {
        fillColor: "#ffffff",
        strokeColor: "#000000",
        opacity: 0.3,
      },
    };

    this.regions.set(region.id, region);
    this.updateSession();

    return region;
  }

  /**
   * Claim a region for a user
   */
  claimRegion(regionId: RegionId, userId: UserId): boolean {
    const region = this.regions.get(regionId);

    if (!region) {
      throw new Error(`Region ${regionId} not found`);
    }

    if (region.claimedBy !== null) {
      return false; // Already claimed
    }

    if (region.locked) {
      return false; // Region is locked
    }

    // Check if user exists in session
    if (!this.session.users[userId]) {
      throw new Error(`User ${userId} not in session`);
    }

    // Claim the region
    region.claimedBy = userId;
    region.claimedAt = Date.now();

    // Update user's claimed regions
    this.session.users[userId].claimedRegions.push(regionId);

    this.updateSession();

    return true;
  }

  /**
   * Release a claimed region
   */
  releaseRegion(regionId: RegionId): boolean {
    const region = this.regions.get(regionId);

    if (!region || !region.claimedBy) {
      return false;
    }

    const userId = region.claimedBy;

    // Remove from user's claimed regions
    const user = this.session.users[userId];
    if (user) {
      user.claimedRegions = user.claimedRegions.filter((id) => id !== regionId);
    }

    // Release the region
    region.claimedBy = null;
    region.claimedAt = null;

    this.updateSession();

    return true;
  }

  /**
   * Lock a region (prevent further editing)
   */
  lockRegion(regionId: RegionId): boolean {
    const region = this.regions.get(regionId);

    if (!region) {
      return false;
    }

    region.locked = true;
    this.updateSession();

    return true;
  }

  /**
   * Unlock a region
   */
  unlockRegion(regionId: RegionId): boolean {
    const region = this.regions.get(regionId);

    if (!region) {
      return false;
    }

    region.locked = false;
    this.updateSession();

    return true;
  }

  /**
   * Get all unclaimed regions
   */
  getUnclaimedRegions(): CanvasRegion[] {
    return Array.from(this.regions.values()).filter(
      (region) => region.claimedBy === null && !region.locked,
    );
  }

  /**
   * Get regions claimed by a specific user
   */
  getUserRegions(userId: UserId): CanvasRegion[] {
    return Array.from(this.regions.values()).filter(
      (region) => region.claimedBy === userId,
    );
  }

  /**
   * Check if a point is inside a region (ray casting algorithm)
   */
  isPointInRegion(
    point: { x: number; y: number },
    regionId: RegionId,
  ): boolean {
    const region = this.regions.get(regionId);

    if (!region) {
      return false;
    }

    return this.pointInPolygon(point, region.points);
  }

  /**
   * Point-in-polygon test using ray casting
   */
  private pointInPolygon(
    point: { x: number; y: number },
    polygon: Array<{ x: number; y: number }>,
  ): boolean {
    let inside = false;
    const { x, y } = point;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Find which region contains a point
   */
  findRegionAtPoint(point: {
    x: number;
    y: number;
  }): CanvasRegion | null {
    for (const region of this.regions.values()) {
      if (this.isPointInRegion(point, region.id)) {
        return region;
      }
    }
    return null;
  }

  /**
   * Check if user has permission to draw at a point
   */
  canUserDrawAtPoint(
    userId: UserId,
    point: { x: number; y: number },
  ): boolean {
    const region = this.findRegionAtPoint(point);

    if (!region) {
      // No region defined at this point
      return this.session.settings.regionMode === "freeform";
    }

    // Check if region is claimed by this user
    return region.claimedBy === userId && !region.locked;
  }

  /**
   * Get canvas permissions for a user
   */
  getUserPermissions(userId: UserId): CanvasPermissions {
    const user = this.session.users[userId];
    const isHost = userId === this.session.hostUserId;

    return {
      userId,
      writableRegions: user?.claimedRegions || [],
      canViewAll: true, // Everyone can view all regions
      canClaimRegions:
        this.session.state === "active" || this.session.state === "setup",
      canModifySession: isHost,
    };
  }

  /**
   * Generate random regions across the canvas (for automated region creation)
   */
  generateRandomRegions(
    canvasWidth: number,
    canvasHeight: number,
    numRegions: number,
  ): CanvasRegion[] {
    const regions: CanvasRegion[] = [];

    // Simple grid-based approach with variation
    const cols = Math.ceil(Math.sqrt(numRegions));
    const rows = Math.ceil(numRegions / cols);

    const cellWidth = canvasWidth / cols;
    const cellHeight = canvasHeight / rows;

    for (let i = 0; i < numRegions; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);

      // Base rectangle
      const x = col * cellWidth;
      const y = row * cellHeight;

      // Add some randomness to make it more organic
      const jitterX = (Math.random() - 0.5) * cellWidth * 0.3;
      const jitterY = (Math.random() - 0.5) * cellHeight * 0.3;

      const points = [
        { x: x + jitterX, y: y + jitterY },
        { x: x + cellWidth + jitterX, y: y + jitterY },
        { x: x + cellWidth + jitterX, y: y + cellHeight + jitterY },
        { x: x + jitterX, y: y + cellHeight + jitterY },
      ];

      const region = this.createRegion(points, {
        fillColor: this.getRandomColor(),
        strokeColor: "#000000",
        opacity: 0.2,
      });

      regions.push(region);
    }

    return regions;
  }

  /**
   * Generate organic/freeform regions using Voronoi-like approach
   */
  generateOrganicRegions(
    canvasWidth: number,
    canvasHeight: number,
    numRegions: number,
  ): CanvasRegion[] {
    // This is a simplified version - a full Voronoi implementation would be more complex
    // For now, we'll use the grid-based approach with more variation

    const regions: CanvasRegion[] = [];

    // Generate random seed points
    const seedPoints: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < numRegions; i++) {
      seedPoints.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight,
      });
    }

    // For each seed, create a rough circular region
    seedPoints.forEach((seed) => {
      const radius = Math.min(canvasWidth, canvasHeight) / (numRegions * 0.8);
      const numPoints = 6 + Math.floor(Math.random() * 4); // 6-9 points
      const points: Array<{ x: number; y: number }> = [];

      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const r = radius * (0.7 + Math.random() * 0.3); // Vary radius

        points.push({
          x: seed.x + Math.cos(angle) * r,
          y: seed.y + Math.sin(angle) * r,
        });
      }

      const region = this.createRegion(points, {
        fillColor: this.getRandomColor(),
        strokeColor: "#000000",
        opacity: 0.2,
      });

      regions.push(region);
    });

    return regions;
  }

  /**
   * Get a random pastel color for region styling
   */
  private getRandomColor(): string {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 85%)`;
  }

  /**
   * Update session with current regions
   */
  private updateSession(): void {
    this.session.regions = Array.from(this.regions.values());
  }

  /**
   * Get region by ID
   */
  getRegion(regionId: RegionId): CanvasRegion | undefined {
    return this.regions.get(regionId);
  }

  /**
   * Get all regions
   */
  getAllRegions(): CanvasRegion[] {
    return Array.from(this.regions.values());
  }

  /**
   * Calculate completion percentage of session
   */
  getCompletionPercentage(): number {
    const totalRegions = this.regions.size;
    if (totalRegions === 0) return 0;

    const claimedRegions = Array.from(this.regions.values()).filter(
      (region) => region.claimedBy !== null,
    ).length;

    return Math.round((claimedRegions / totalRegions) * 100);
  }
}
