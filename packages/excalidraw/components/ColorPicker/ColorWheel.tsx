import React, { useRef, useEffect, useState, useCallback } from "react";
import { colorWheelIcon } from "../icons";
import clsx from "clsx";
import { t } from "../../i18n";
import './ColorWheel.scss';

interface ColorWheelProps {
  color: string;
  onChange: (color: string) => void;
}

const CANVAS_SIZE = 150;

const ColorWheel: React.FC<ColorWheelProps> = ({ color, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Draw the color wheel
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = CANVAS_SIZE / 2;
    const centerY = CANVAS_SIZE / 2;
    const radius = (CANVAS_SIZE / 2) - 5;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw main color wheel
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = (angle + 1) * Math.PI / 180;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      const gradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, radius
      );

      // Convert angle to hue
      const hue = angle;
      gradient.addColorStop(0, `hsl(${hue}, 0%, 100%)`);
      gradient.addColorStop(1, `hsl(${hue}, 100%, 50%)`);

      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }, []);

  // Handle canvas click
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(x, y, 1, 1).data;
    const color = `rgb(${imageData[0]}, ${imageData[1]}, ${imageData[2]})`;
    onChange(color);
  }, [onChange]);

  // Position the color wheel when opened
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPosition({
        x: Math.min(window.innerWidth - CANVAS_SIZE - 20, rect.right + 10),
        y: Math.min(window.innerHeight - CANVAS_SIZE - 20, rect.bottom + 10)
      });
    }
  }, [isOpen]);

  // Draw the wheel when opened
  useEffect(() => {
    if (isOpen) {
      drawWheel();
    }
  }, [isOpen, drawWheel]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="color-wheel-container">
      <div
        className={clsx("excalidraw-colorwheel-trigger", { selected: isOpen })}
        onClick={() => setIsOpen(!isOpen)}
        title={t("labels.colorWheel")}
      >
        {colorWheelIcon}
      </div>
      
      {isOpen && (
        <div
          className="color-wheel-popup"
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            backgroundColor: 'white',
            padding: '10px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            zIndex: 1000
          }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            onClick={handleClick}
            style={{ cursor: 'pointer' }}
          />
        </div>
      )}
    </div>
  );
};

export default ColorWheel;