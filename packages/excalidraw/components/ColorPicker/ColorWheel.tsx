import React, { useRef, useEffect, useState } from "react";

interface ColorWheelProps {
  onChange: (color: string) => void; 
}

const ColorWheel: React.FC<ColorWheelProps> = ({ onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedColor, setSelectedColor] = useState<string>("#ffffff");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const radius = Math.min(width, height) / 2;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - width / 2;
        const dy = y - height / 2;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > radius) continue;

        const angle = Math.atan2(dy, dx) + Math.PI;
        const hue = (angle / (2 * Math.PI)) * 360;
        const saturation = (distance / radius) * 100;

        const { r, g, b } = hslToRgb(hue, saturation, 50);
        const index = (y * width + x) * 4;
        data[index] = r;
        data[index + 1] = g;
        data[index + 2] = b;
        data[index + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, []);

  const hslToRgb = (h: number, s: number, l: number) => {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
  };

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const color = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
    setSelectedColor(color);
    onChange(color); 
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        onClick={handleClick}
        className="cursor-pointer border border-gray-300 rounded-full"
      ></canvas>
      <div className="flex items-center gap-2">
        <div
          className="w-10 h-10 rounded-full border border-gray-600"
          style={{ backgroundColor: selectedColor }}
        ></div>
        <p>{selectedColor}</p>
      </div>
    </div>
  );
};

export default ColorWheel;
