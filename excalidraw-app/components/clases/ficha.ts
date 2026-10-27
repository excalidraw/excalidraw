// Ficha de sesión: datos de la tutoría + encabezado visual para la pizarra.
// El encabezado se inserta como elementos agrupados (se mueven en bloque).

import type { ExcalidrawElementSkeleton } from "@excalidraw/element/transform";

export interface FichaSesion {
  alumno: string;
  materia: string;
  temas: string;
  sesion: string;
  fecha: string;
}

export const AZUL_NABORI = "#03045e";

export function fechaHoy(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function fichaVacia(): FichaSesion {
  return { alumno: "", materia: "", temas: "", sesion: "", fecha: fechaHoy() };
}

export function sanear(s: string, max = 60): string {
  return s
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[/\\:*?"<>|]/g, "")
    .slice(0, max);
}

function recortar(s: string, max = 52): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Encabezado de 640×176 en origen (0,0); al insertar se desplaza. */
export function construirEncabezado(
  ficha: FichaSesion,
): ExcalidrawElementSkeleton[] {
  const gid = `ficha-${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const grupo = { groupIds: [gid] } as const;
  const tinta = "#ffffff";
  const alumno = recortar(ficha.alumno) || "—";
  const sesion = ficha.sesion.trim() ? `#${ficha.sesion.trim()}` : "#—";
  return [
    {
      type: "rectangle",
      x: 0,
      y: 0,
      width: 640,
      height: 176,
      strokeColor: AZUL_NABORI,
      strokeWidth: 2,
      backgroundColor: AZUL_NABORI,
      ...grupo,
    } as ExcalidrawElementSkeleton,
    {
      type: "text",
      x: 20,
      y: 12,
      text: "TUTORÍA · NABORI",
      fontSize: 26,
      strokeColor: tinta,
      ...grupo,
    } as ExcalidrawElementSkeleton,
    {
      type: "text",
      x: 20,
      y: 50,
      text: `Estudiante: ${alumno}   ·   Sesión ${sesion}`,
      fontSize: 20,
      strokeColor: tinta,
      ...grupo,
    } as ExcalidrawElementSkeleton,
    {
      type: "text",
      x: 20,
      y: 80,
      text: `Materia: ${recortar(ficha.materia) || "—"}`,
      fontSize: 20,
      strokeColor: tinta,
      ...grupo,
    } as ExcalidrawElementSkeleton,
    {
      type: "text",
      x: 20,
      y: 110,
      text: `Tema(s): ${recortar(ficha.temas, 60) || "—"}`,
      fontSize: 20,
      strokeColor: tinta,
      ...grupo,
    } as ExcalidrawElementSkeleton,
    {
      type: "text",
      x: 20,
      y: 140,
      text: `Fecha: ${ficha.fecha.trim() || fechaHoy()}`,
      fontSize: 20,
      strokeColor: tinta,
      ...grupo,
    } as ExcalidrawElementSkeleton,
  ];
}

/** Línea corta para la lista del historial: "S3 · Matemática · Ecuaciones". */
export function resumenFicha(meta: {
  sesion?: string;
  materia?: string;
  temas?: string;
}): string | null {
  const partes: string[] = [];
  if (meta.sesion?.trim()) {
    partes.push(`S${meta.sesion.trim()}`);
  }
  if (meta.materia?.trim()) {
    partes.push(meta.materia.trim());
  }
  if (meta.temas?.trim()) {
    partes.push(meta.temas.trim());
  }
  return partes.length > 0 ? partes.join(" · ") : null;
}

/** Nombre de archivo detallado para Descargar. */
export function nombreArchivoFicha(meta: {
  alumno: string;
  fechaISO: string;
  sesion?: string;
  materia?: string;
}): string {
  const alumno = sanear(meta.alumno) || "Alumno";
  const fecha = meta.fechaISO.slice(0, 10);
  const sesion = meta.sesion?.trim() ? `_S${sanear(meta.sesion, 10)}` : "";
  const materia = meta.materia?.trim() ? `_${sanear(meta.materia, 30)}` : "";
  return `Pizarra_${alumno}${sesion}${materia}_${fecha}.excalidraw`;
}
