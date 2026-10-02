// Figuras matemáticas insertables de un clic (vía librería/plantilla, no son tools).
// Cada figura es una lista de skeletons en origen (0,0); al insertar se desplazan.
import type { ExcalidrawElementSkeleton } from "@excalidraw/element/transform";

export interface Figura {
  id: string;
  nombre: string;
  construir(): ExcalidrawElementSkeleton[];
}

const TINTA = "#1e1e1e";
const ANCHO = 2;

export const FIGURAS: Figura[] = [
  {
    id: "ejes",
    nombre: "Ejes cartesianos",
    construir: () => [
      {
        type: "arrow",
        x: 0,
        y: 150,
        width: 320,
        height: 0,
        strokeColor: TINTA,
        strokeWidth: ANCHO,
      } as ExcalidrawElementSkeleton,
      {
        type: "arrow",
        x: 160,
        y: 310,
        width: 0,
        height: -310,
        strokeColor: TINTA,
        strokeWidth: ANCHO,
      } as ExcalidrawElementSkeleton,
      {
        type: "text",
        x: 330,
        y: 140,
        text: "x",
        fontSize: 24,
        strokeColor: TINTA,
      } as ExcalidrawElementSkeleton,
      {
        type: "text",
        x: 170,
        y: 0,
        text: "y",
        fontSize: 24,
        strokeColor: TINTA,
      } as ExcalidrawElementSkeleton,
      {
        type: "text",
        x: 130,
        y: 160,
        text: "0",
        fontSize: 20,
        strokeColor: TINTA,
      } as ExcalidrawElementSkeleton,
    ],
  },
  {
    id: "recta",
    nombre: "Recta numérica",
    construir: () => {
      const partes: ExcalidrawElementSkeleton[] = [
        {
          type: "arrow",
          x: 0,
          y: 40,
          width: 420,
          height: 0,
          strokeColor: TINTA,
          strokeWidth: ANCHO,
        } as ExcalidrawElementSkeleton,
      ];
      for (let i = 0; i <= 6; i++) {
        const x = 20 + i * 60;
        partes.push(
          {
            type: "line",
            x,
            y: 28,
            width: 0,
            height: 24,
            strokeColor: TINTA,
            strokeWidth: ANCHO,
          } as ExcalidrawElementSkeleton,
          {
            type: "text",
            x: x - 8,
            y: 58,
            text: `${i - 3}`,
            fontSize: 20,
            strokeColor: TINTA,
          } as ExcalidrawElementSkeleton,
        );
      }
      return partes;
    },
  },
  {
    id: "triangulo",
    nombre: "Triángulo rectángulo",
    construir: () => [
      {
        type: "line",
        x: 0,
        y: 200,
        width: 240,
        height: 0,
        strokeColor: TINTA,
        strokeWidth: ANCHO,
      } as ExcalidrawElementSkeleton,
      {
        type: "line",
        x: 0,
        y: 200,
        width: 0,
        height: 200,
        strokeColor: TINTA,
        strokeWidth: ANCHO,
      } as ExcalidrawElementSkeleton,
      {
        type: "line",
        x: 0,
        y: 0,
        width: 240,
        height: 200,
        strokeColor: TINTA,
        strokeWidth: ANCHO,
      } as ExcalidrawElementSkeleton,
      {
        type: "rectangle",
        x: 0,
        y: 168,
        width: 32,
        height: 32,
        strokeColor: TINTA,
        strokeWidth: ANCHO,
        backgroundColor: "transparent",
      } as ExcalidrawElementSkeleton,
      {
        type: "text",
        x: 100,
        y: 210,
        text: "a",
        fontSize: 24,
        strokeColor: TINTA,
      } as ExcalidrawElementSkeleton,
      {
        type: "text",
        x: -28,
        y: 90,
        text: "b",
        fontSize: 24,
        strokeColor: TINTA,
      } as ExcalidrawElementSkeleton,
      {
        type: "text",
        x: 130,
        y: 80,
        text: "c",
        fontSize: 24,
        strokeColor: TINTA,
      } as ExcalidrawElementSkeleton,
    ],
  },
  {
    id: "circulo",
    nombre: "Círculo con radio",
    construir: () => [
      {
        type: "ellipse",
        x: 0,
        y: 0,
        width: 240,
        height: 240,
        strokeColor: TINTA,
        strokeWidth: ANCHO,
        backgroundColor: "transparent",
      } as ExcalidrawElementSkeleton,
      {
        type: "line",
        x: 120,
        y: 120,
        width: 120,
        height: 0,
        strokeColor: TINTA,
        strokeWidth: ANCHO,
      } as ExcalidrawElementSkeleton,
      {
        type: "text",
        x: 165,
        y: 92,
        text: "r",
        fontSize: 24,
        strokeColor: TINTA,
      } as ExcalidrawElementSkeleton,
      {
        type: "text",
        x: 112,
        y: 112,
        text: "•",
        fontSize: 28,
        strokeColor: TINTA,
      } as ExcalidrawElementSkeleton,
    ],
  },
  {
    id: "transportador",
    nombre: "Transportador (180°)",
    construir: () => {
      const partes: ExcalidrawElementSkeleton[] = [
        {
          type: "ellipse",
          x: 0,
          y: 0,
          width: 320,
          height: 320,
          strokeColor: TINTA,
          strokeWidth: ANCHO,
          backgroundColor: "transparent",
        } as ExcalidrawElementSkeleton,
        {
          type: "line",
          x: 0,
          y: 160,
          width: 320,
          height: 0,
          strokeColor: TINTA,
          strokeWidth: ANCHO,
        } as ExcalidrawElementSkeleton,
      ];
      const cx = 160;
      const cy = 160;
      const r = 160;
      for (let g = 0; g <= 180; g += 15) {
        const rad = ((180 - g) * Math.PI) / 180;
        const largo = g % 45 === 0 ? 28 : 14;
        const x1 = cx + Math.cos(rad) * r;
        const y1 = cy - Math.sin(rad) * r;
        const x2 = cx + Math.cos(rad) * (r - largo);
        const y2 = cy - Math.sin(rad) * (r - largo);
        partes.push({
          type: "line",
          x: Math.round(x1),
          y: Math.round(y1),
          width: Math.round(x2 - x1),
          height: Math.round(y2 - y1),
          strokeColor: TINTA,
          strokeWidth: ANCHO,
        } as ExcalidrawElementSkeleton);
        if (g % 45 === 0) {
          partes.push({
            type: "text",
            x: Math.round(cx + Math.cos(rad) * (r - 52)) - 12,
            y: Math.round(cy - Math.sin(rad) * (r - 52)) - 12,
            text: `${g}°`,
            fontSize: 18,
            strokeColor: TINTA,
          } as ExcalidrawElementSkeleton);
        }
      }
      return partes;
    },
  },
  {
    id: "compas",
    nombre: "Compás",
    construir: () => [
      {
        type: "ellipse",
        x: 108,
        y: 0,
        width: 24,
        height: 24,
        strokeColor: TINTA,
        strokeWidth: ANCHO,
        backgroundColor: "transparent",
      } as ExcalidrawElementSkeleton,
      {
        type: "line",
        x: 120,
        y: 24,
        width: -70,
        height: 190,
        strokeColor: TINTA,
        strokeWidth: ANCHO,
      } as ExcalidrawElementSkeleton,
      {
        type: "line",
        x: 120,
        y: 24,
        width: 70,
        height: 190,
        strokeColor: TINTA,
        strokeWidth: ANCHO,
      } as ExcalidrawElementSkeleton,
      {
        type: "ellipse",
        x: 38,
        y: 202,
        width: 24,
        height: 24,
        strokeColor: TINTA,
        strokeWidth: ANCHO,
        backgroundColor: "transparent",
      } as ExcalidrawElementSkeleton,
    ],
  },
  {
    id: "fraccion",
    nombre: "Fracción visual (3/4)",
    construir: () => {
      const partes: ExcalidrawElementSkeleton[] = [
        {
          type: "rectangle",
          x: 0,
          y: 0,
          width: 240,
          height: 120,
          strokeColor: TINTA,
          strokeWidth: ANCHO,
          backgroundColor: "transparent",
        } as ExcalidrawElementSkeleton,
      ];
      for (let i = 1; i < 4; i++) {
        partes.push({
          type: "line",
          x: i * 60,
          y: 0,
          width: 0,
          height: 120,
          strokeColor: TINTA,
          strokeWidth: ANCHO,
        } as ExcalidrawElementSkeleton);
      }
      for (let i = 0; i < 3; i++) {
        partes.push({
          type: "rectangle",
          x: i * 60 + 4,
          y: 4,
          width: 52,
          height: 112,
          strokeColor: "transparent",
          backgroundColor: "#93c5fd",
        } as ExcalidrawElementSkeleton);
      }
      partes.push({
        type: "text",
        x: 90,
        y: 140,
        text: "3/4",
        fontSize: 28,
        strokeColor: TINTA,
      } as ExcalidrawElementSkeleton);
      return partes;
    },
  },
  {
    id: "angulo",
    nombre: "Ángulo θ",
    construir: () => [
      {
        type: "arrow",
        x: 0,
        y: 120,
        width: 220,
        height: 0,
        strokeColor: TINTA,
        strokeWidth: ANCHO,
      } as ExcalidrawElementSkeleton,
      {
        type: "arrow",
        x: 0,
        y: 120,
        width: 190,
        height: 110,
        strokeColor: TINTA,
        strokeWidth: ANCHO,
      } as ExcalidrawElementSkeleton,
      {
        type: "text",
        x: 78,
        y: 96,
        text: "θ",
        fontSize: 28,
        strokeColor: TINTA,
      } as ExcalidrawElementSkeleton,
    ],
  },
];
