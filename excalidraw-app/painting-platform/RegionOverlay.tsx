/**
 * RegionOverlay - Visual overlay showing canvas regions
 */

import React from "react";
import type { CanvasRegion, UserId, PaintingUser } from "./types";

interface RegionOverlayProps {
  regions: CanvasRegion[];
  users: Record<UserId, PaintingUser>;
  currentUserId: UserId;
  zoom: number;
  scrollX: number;
  scrollY: number;
  canvasWidth: number;
  canvasHeight: number;
  onRegionClick?: (regionId: string) => void;
  showLabels?: boolean;
}

/**
 * Renders regions as SVG overlay on the canvas
 */
export const RegionOverlay: React.FC<RegionOverlayProps> = ({
  regions,
  users,
  currentUserId,
  zoom,
  scrollX,
  scrollY,
  canvasWidth,
  canvasHeight,
  onRegionClick,
  showLabels = true,
}) => {
  const handleRegionClick = (regionId: string) => {
    if (onRegionClick) {
      onRegionClick(regionId);
    }
  };

  const getRegionLabel = (region: CanvasRegion): string => {
    if (!region.claimedBy) {
      return "Unclaimed";
    }
    const user = users[region.claimedBy];
    return user ? user.username : "Unknown";
  };

  const getRegionColor = (region: CanvasRegion): string => {
    if (region.locked) {
      return "#94a3b8"; // Gray for locked
    }

    if (!region.claimedBy) {
      return region.style?.fillColor || "#e2e8f0";
    }

    // Use user's color
    const user = users[region.claimedBy];
    return user?.color || region.style?.fillColor || "#cbd5e1";
  };

  const getRegionOpacity = (region: CanvasRegion): number => {
    if (region.claimedBy === currentUserId) {
      return 0.3; // More opaque for current user's regions
    }
    if (region.claimedBy) {
      return 0.15; // Less opaque for others' regions
    }
    return 0.1; // Very transparent for unclaimed
  };

  const getRegionStrokeWidth = (region: CanvasRegion): number => {
    if (region.claimedBy === currentUserId) {
      return 3;
    }
    return 1.5;
  };

  const getRegionStrokeStyle = (region: CanvasRegion): string => {
    if (region.locked) {
      return "4,4"; // Dashed for locked
    }
    if (!region.claimedBy) {
      return "2,2"; // Dotted for unclaimed
    }
    return ""; // Solid for claimed
  };

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 100,
      }}
      viewBox={`${scrollX} ${scrollY} ${canvasWidth / zoom} ${canvasHeight / zoom}`}
    >
      <defs>
        {/* Pattern for unclaimed regions */}
        <pattern
          id="unclaimed-pattern"
          patternUnits="userSpaceOnUse"
          width="20"
          height="20"
        >
          <circle cx="10" cy="10" r="1" fill="#94a3b8" opacity="0.3" />
        </pattern>
      </defs>

      {regions.map((region) => {
        // Convert points to SVG path
        const pathData = region.points
          .map((point, index) => {
            const command = index === 0 ? "M" : "L";
            return `${command} ${point.x} ${point.y}`;
          })
          .join(" ");

        const closedPath = `${pathData} Z`;

        // Calculate center for label
        const centerX =
          region.points.reduce((sum, p) => sum + p.x, 0) /
          region.points.length;
        const centerY =
          region.points.reduce((sum, p) => sum + p.y, 0) /
          region.points.length;

        return (
          <g
            key={region.id}
            style={{ pointerEvents: "auto", cursor: "pointer" }}
            onClick={() => handleRegionClick(region.id)}
          >
            {/* Region fill */}
            <path
              d={closedPath}
              fill={
                !region.claimedBy ? "url(#unclaimed-pattern)" : getRegionColor(region)
              }
              fillOpacity={getRegionOpacity(region)}
              stroke={
                region.claimedBy === currentUserId
                  ? "#3b82f6"
                  : getRegionColor(region)
              }
              strokeWidth={getRegionStrokeWidth(region) / zoom}
              strokeDasharray={getRegionStrokeStyle(region)}
            />

            {/* Region label */}
            {showLabels && (
              <g>
                {/* Background for text */}
                <rect
                  x={centerX - 50}
                  y={centerY - 12}
                  width="100"
                  height="24"
                  rx="4"
                  fill="white"
                  fillOpacity="0.9"
                  stroke={getRegionColor(region)}
                  strokeWidth={1 / zoom}
                />
                {/* Text */}
                <text
                  x={centerX}
                  y={centerY + 4}
                  textAnchor="middle"
                  fontSize={12 / zoom}
                  fontWeight={region.claimedBy === currentUserId ? "bold" : "normal"}
                  fill="#1e293b"
                >
                  {getRegionLabel(region)}
                </text>
                {/* Lock icon for locked regions */}
                {region.locked && (
                  <text
                    x={centerX}
                    y={centerY + 20}
                    textAnchor="middle"
                    fontSize={10 / zoom}
                    fill="#64748b"
                  >
                    🔒
                  </text>
                )}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export default RegionOverlay;
