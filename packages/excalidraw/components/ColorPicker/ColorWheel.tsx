import React, { useRef, useEffect, useState, useCallback } from "react";
import { colorWheelIcon } from "../icons";
import clsx from "clsx";
import { t } from "../../i18n";
import "./ColorWheel.scss";

interface ColorWheelProps {
  color: string;
  onChange: (color: string) => void;
}

const CANVAS_SIZE = 150;

const ColorWheel: React.FC<ColorWheelProps> = ({ color, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const centerX = CANVAS_SIZE / 2;
    const centerY = CANVAS_SIZE / 2;
    const radius = CANVAS_SIZE / 2 - 5;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    for (let angle = 0; angle < 360; angle++) {
      const startAngle = ((angle - 1) * Math.PI) / 180;
      const endAngle = ((angle + 1) * Math.PI) / 180;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius,
      );
      const hue = angle;
      gradient.addColorStop(0, `hsl(${hue}, 0%, 100%)`);
      gradient.addColorStop(1, `hsl(${hue}, 100%, 50%)`);

      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      const imageData = ctx.getImageData(x, y, 1, 1).data;
      const color = `rgb(${imageData[0]}, ${imageData[1]}, ${imageData[2]})`;
      onChange(color);
    },
    [onChange],
  );

  useEffect(() => {
    if (isOpen) {
      drawWheel();
    }
  }, [isOpen, drawWheel]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="excalidraw-color-wheel-container">
      <div
        className={clsx("excalidraw-colorwheel-trigger", { selected: isOpen })}
        onClick={() => setIsOpen((prev) => !prev)}
        title={t("labels.colorWheel")}
      >
        {colorWheelIcon}
      </div>

      {isOpen && (
        <div
          className="excalidraw-color-wheel-popup"
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "white",
            padding: "10px",
            borderRadius: "8px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            zIndex: 1000,
            cursor: "grab",
          }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            onClick={handleClick}
            style={{ cursor: "pointer" }}
          />
        </div>
      )}
    </div>
  );
};

export default ColorWheel;
