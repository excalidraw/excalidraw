import React, { useRef, useEffect, useState, useCallback } from "react";
import { colorWheelIcon } from "../icons";
import clsx from "clsx";
import { t } from "../../i18n";

interface ColorWheelProps {
  color: string;
  onChange: (color: string) => void;
}

const ColorWheel: React.FC<ColorWheelProps> = ({ color, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorWheelRef = useRef<HTMLDivElement>(null);
  const colorWheelTriggerRef = useRef<HTMLDivElement>(null);
  const dragHeaderRef = useRef<HTMLDivElement>(null);

  const [isColorWheelOpen, setIsColorWheelOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Draw the color wheel when it becomes visible
  useEffect(() => {
    if (!isColorWheelOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw color wheel with improved color distribution
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Calculate distance from center
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Only draw within the circle
        if (distance <= radius) {
          // Calculate hue and saturation based on position
          const angle = Math.atan2(dy, dx);
          const hue = ((angle * 180 / Math.PI) + 360) % 360;
          const saturation = Math.min(distance / radius, 1);

          // Convert HSL to RGB
          const [r, g, b] = hslToRgb(hue, saturation, 0.5);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    // Add white center
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
  }, [isColorWheelOpen]);

  // Position the color wheel in the center of the screen when opened
  useEffect(() => {
    if (isColorWheelOpen) {
      setPosition({
        x: window.innerWidth / 2 - 75,
        y: window.innerHeight / 2 - 100,
      });
    }
  }, [isColorWheelOpen]);

  // Convert HSL to RGB with improved accuracy
  const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    h = h % 360;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 60) {
      [r, g, b] = [c, x, 0];
    } else if (h >= 60 && h < 120) {
      [r, g, b] = [x, c, 0];
    } else if (h >= 120 && h < 180) {
      [r, g, b] = [0, c, x];
    } else if (h >= 180 && h < 240) {
      [r, g, b] = [0, x, c];
    } else if (h >= 240 && h < 300) {
      [r, g, b] = [x, 0, c];
    } else {
      [r, g, b] = [c, 0, x];
    }

    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255)
    ];
  };

  // Improved click handling with bounds checking
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(e.clientX - rect.left);
      const y = Math.floor(e.clientY - rect.top);

      // Check if click is within canvas bounds
      if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Get color at clicked position
      const pixelData = ctx.getImageData(x, y, 1, 1).data;
      const hex = `#${[pixelData[0], pixelData[1], pixelData[2]]
        .map(n => n.toString(16).padStart(2, '0'))
        .join('')}`;

      onChange(hex);
    },
    [onChange]
  );

  // Drag handling logic
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (colorWheelRef.current && dragHeaderRef.current?.contains(e.target as Node)) {
      setIsDragging(true);
      const rect = colorWheelRef.current.getBoundingClientRect();
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, []);

  const handleDrag = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        const newX = Math.max(0, Math.min(window.innerWidth - 150, e.clientX - dragOffset.x));
        const newY = Math.max(0, Math.min(window.innerHeight - 150, e.clientY - dragOffset.y));
        setPosition({ x: newX, y: newY });
      }
    },
    [isDragging, dragOffset]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Click outside handling
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        colorWheelRef.current &&
        !colorWheelRef.current.contains(event.target as Node) &&
        !colorWheelTriggerRef.current?.contains(event.target as Node)
      ) {
        setIsColorWheelOpen(false);
      }
    };

    if (isColorWheelOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("mousemove", handleDrag);
      window.addEventListener("mouseup", handleDragEnd);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("mousemove", handleDrag);
      window.removeEventListener("mouseup", handleDragEnd);
    };
  }, [isColorWheelOpen, handleDrag, handleDragEnd]);

  return (
    <>
      <div
        ref={colorWheelTriggerRef}
        className={clsx("excalidraw-colorwheel-trigger", { selected: isColorWheelOpen })}
        onClick={() => setIsColorWheelOpen(!isColorWheelOpen)}
        title={t("labels.colorWheel")}
      >
        {colorWheelIcon}
      </div>
      {isColorWheelOpen && (
        <div
          ref={colorWheelRef}
          className="excalidraw-color-picker-popup"
          style={{
            position: "fixed",
            left: `${position.x}px`,
            top: `${position.y}px`,
            userSelect: "none"
          }}
        >
          <div
            ref={dragHeaderRef}
            className="excalidraw-color-picker-popup-header"
            onMouseDown={handleDragStart}
          >
            <button
              className="excalidraw-color-picker-popup-close"
              onClick={() => setIsColorWheelOpen(false)}
            >
              ×
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={150}
            height={150}
            onClick={handleCanvasClick}
          />
        </div>
      )}
    </>
  );
};

export default ColorWheel;