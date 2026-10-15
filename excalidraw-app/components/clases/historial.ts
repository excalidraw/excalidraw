import { createStore, get, set, del, keys } from "idb-keyval";

import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

export interface PizarraGuardada {
  key: string;
  alumno: string;
  fechaISO: string;
  numElementos: number;
}

interface RegistroHistorial {
  meta: PizarraGuardada;
  escena: {
    type: string;
    version: number;
    source: string;
    elements: unknown[];
    appState: null;
    files: Record<string, unknown>;
  };
}

const store = createStore("clases-db", "historial");
const PREFIJO = "historial:";

function sanitizeNombre(nombre: string): string {
  return nombre
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[/\\:*?"<>|]/g, "")
    .slice(0, 60);
}

export async function guardarPizarra(
  api: ExcalidrawImperativeAPI,
  alumno: string,
): Promise<PizarraGuardada> {
  const nombre = sanitizeNombre(alumno) || "Alumno";
  const fechaISO = new Date().toISOString();
  const key = `${PREFIJO}${nombre}/${fechaISO.replace(/[:.]/g, "-")}`;
  const elements = api.getSceneElements();
  const files = api.getFiles();
  const registro: RegistroHistorial = {
    meta: {
      key,
      alumno: alumno.trim(),
      fechaISO,
      numElementos: elements.length,
    },
    escena: {
      type: "excalidraw",
      version: 2,
      source: "excalidraw-clases",
      elements: elements as unknown[],
      appState: null,
      files: files as Record<string, unknown>,
    },
  };
  await set(key, registro, store);
  return registro.meta;
}

export async function listarPizarras(): Promise<PizarraGuardada[]> {
  const todas = await keys(store);
  const metas: PizarraGuardada[] = [];
  for (const k of todas) {
    if (typeof k === "string" && k.startsWith(PREFIJO)) {
      const reg = await get<RegistroHistorial>(k, store);
      if (reg?.meta) {
        metas.push(reg.meta);
      }
    }
  }
  metas.sort((a, b) => (a.fechaISO < b.fechaISO ? 1 : -1));
  return metas;
}

export async function cargarPizarra(api: ExcalidrawImperativeAPI, key: string) {
  const reg = await get<RegistroHistorial>(key, store);
  if (!reg) {
    throw new Error("No se encontró la pizarra guardada.");
  }
  const archivos = Object.values(reg.escena.files ?? {});
  if (archivos.length > 0) {
    api.addFiles(
      archivos as Parameters<ExcalidrawImperativeAPI["addFiles"]>[0],
    );
  }
  const elementos = convertToExcalidrawElements(
    reg.escena.elements as Parameters<typeof convertToExcalidrawElements>[0],
    { regenerateIds: false },
  );
  api.updateScene({
    elements: elementos,
    appState: {
      selectedElementIds: {},
    },
  });
}

export async function borrarPizarra(key: string) {
  await del(key, store);
}

export function descargarPizarra(
  meta: PizarraGuardada,
  getRegistro: () => Promise<RegistroHistorial | undefined>,
) {
  getRegistro().then((reg) => {
    if (!reg) {
      return;
    }
    const blob = new Blob([JSON.stringify(reg.escena, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Pizarra_${meta.alumno.replace(
      /\s+/g,
      "_",
    )}_${meta.fechaISO.slice(0, 10)}.excalidraw`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
}

export async function obtenerRegistro(key: string) {
  return get<RegistroHistorial>(key, store);
}
