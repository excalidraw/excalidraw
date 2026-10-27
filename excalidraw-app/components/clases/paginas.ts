// Páginas de clase (estilo Zoom Whiteboard / OneNote).
//
// Idea para el docente: NO hay que aprender frames, tamaños ni atajos.
// En la pantalla solo se ven páginas con nombre ("Teoría", "Ejemplos"...),
// y tocar una página salta a ella en pantalla completa, sin scroll.
//
// Por dentro, cada página es un frame de Excalidraw: así la página se
// guarda con la pizarra, se exporta y se sincroniza en colaboración con
// el resto de la escena, sin inventar un almacenamiento nuevo. Este
// archivo es el único sitio donde se habla de frames; el panel solo
// habla de páginas.
//
// Este módulo es aditivo: no modifica ningún feature existente
// (Panel de clase, historial, IA, ficha, importar PDF).

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElementSkeleton } from "@excalidraw/element/transform";

import { insertarSkeletons } from "./insertar";

export interface Pagina {
  id: string;
  nombre: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Las 4 páginas de clase que se ofrecen al crear una clase nueva. */
export const PAGINAS_CLASE = [
  "Teoría",
  "Ejemplos",
  "Ejercicios",
  "Soluciones",
] as const;

const ANCHO_PAGINA = 1600;
const ALTO_PAGINA = 900;
const SEPARACION = 200;

/** Elementos frame de la escena, ordenados de izquierda a derecha. */
export function listarPaginas(api: ExcalidrawImperativeAPI): Pagina[] {
  const paginas: Pagina[] = [];
  for (const el of api.getSceneElements()) {
    if (el.type !== "frame" || el.isDeleted) {
      continue;
    }
    const nombre = (el as { name?: string | null }).name;
    paginas.push({
      id: el.id,
      nombre: nombre?.trim() ? nombre.trim() : "Página sin nombre",
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
    });
  }
  // Orden de lectura: primero de izquierda a derecha, luego de arriba abajo.
  paginas.sort((a, b) => a.x - b.x || a.y - b.y);
  return paginas;
}

function siguientePosicion(api: ExcalidrawImperativeAPI): {
  x: number;
  y: number;
} {
  const paginas = listarPaginas(api);
  if (paginas.length > 0) {
    const ultima = paginas[paginas.length - 1];
    return { x: ultima.x + ultima.width + SEPARACION, y: ultima.y };
  }
  // Sin páginas todavía: a la derecha de lo que ya haya en la pizarra,
  // o en el origen si la pizarra está vacía.
  let derecha = 0;
  let hayContenido = false;
  for (const el of api.getSceneElements()) {
    if (el.isDeleted) {
      continue;
    }
    hayContenido = true;
    derecha = Math.max(derecha, el.x + el.width);
  }
  return hayContenido
    ? { x: derecha + SEPARACION, y: 0 }
    : { x: 0, y: 0 };
}

/**
 * Crea una página nueva con ese nombre y salta a ella.
 * Si el nombre viene vacío, se usa "Página N".
 */
export function crearPagina(
  api: ExcalidrawImperativeAPI,
  nombre: string,
): Pagina | null {
  const existentes = listarPaginas(api);
  const limpio = nombre.trim();
  const titulo = limpio || `Página ${existentes.length + 1}`;
  const { x, y } = siguientePosicion(api);
  const nuevos = insertarSkeletons(
    api,
    [
      {
        type: "frame",
        name: titulo,
        x: 0,
        y: 0,
        width: ANCHO_PAGINA,
        height: ALTO_PAGINA,
      } as unknown as ExcalidrawElementSkeleton,
    ],
    x,
    y,
  );
  const creado = nuevos[0];
  if (!creado) {
    return null;
  }
  const pagina: Pagina = {
    id: creado.id,
    nombre: titulo,
    x,
    y,
    width: ANCHO_PAGINA,
    height: ALTO_PAGINA,
  };
  irAPagina(api, pagina);
  return pagina;
}

/**
 * Crea las 4 páginas de clase que falten (Teoría, Ejemplos, Ejercicios,
 * Soluciones). Las que ya existen, por nombre, no se duplican.
 * Devuelve las páginas creadas en esta llamada.
 */
export function crearPaginasClase(
  api: ExcalidrawImperativeAPI,
): Pagina[] {
  const nombres = new Set(
    listarPaginas(api).map((p) => p.nombre.toLowerCase()),
  );
  const creadas: Pagina[] = [];
  for (const titulo of PAGINAS_CLASE) {
    if (nombres.has(titulo.toLowerCase())) {
      continue;
    }
    const pagina = crearPagina(api, titulo);
    if (pagina) {
      creadas.push(pagina);
      nombres.add(titulo.toLowerCase());
    }
  }
  if (creadas.length > 0) {
    irAPagina(api, creadas[0]);
  }
  return creadas;
}

/** Salta a una página en pantalla completa, sin scroll manual. */
export function irAPagina(
  api: ExcalidrawImperativeAPI,
  pagina: Pagina,
): void {
  const elemento = api
    .getSceneElements()
    .find((el) => el.id === pagina.id);
  if (!elemento) {
    return;
  }
  // El panel de páginas ocupa el lado izquierdo: se reserva ese espacio
  // para que la página no quede centrada debajo del panel.
  api.setViewport({
    target: elemento,
    fit: "contain",
    animation: true,
    offsets: { left: 284 },
  });
}

/** Cambia el nombre de una página. */
export function renombrarPagina(
  api: ExcalidrawImperativeAPI,
  id: string,
  nombre: string,
): void {
  const limpio = nombre.trim();
  if (!limpio) {
    return;
  }
  api.updateScene({
    elements: api.getSceneElements().map((el) =>
      el.id === id && el.type === "frame" ? { ...el, name: limpio } : el,
    ),
  });
}
