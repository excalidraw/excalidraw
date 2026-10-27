import { createStore, get, set, del, keys } from "idb-keyval";

import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { nombreArchivoFicha } from "./ficha";

import type { FichaSesion } from "./ficha";

export interface PizarraGuardada {
  key: string;
  alumno: string;
  fechaISO: string;
  numElementos: number;
  materia?: string;
  temas?: string;
  sesion?: string;
  fechaSesion?: string;
}

export interface RegistroHistorial {
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

export interface EstadoAlmacenamiento {
  disponible: boolean;
  persistido: boolean;
  quotaMB: number | null;
  usoMB: number | null;
  origen: string;
  mensaje: string;
}

const store = createStore("clases-db", "historial");
const PREFIJO = "historial:";
const ULTIMA_SESION_KEY = "ultima-sesion";

function sanitizeNombre(nombre: string): string {
  return nombre
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[/\\:*?"<>|]/g, "")
    .slice(0, 60);
}

function esErrorQuota(e: unknown): boolean {
  if (!e || typeof e !== "object") {
    return false;
  }
  const err = e as { name?: string; message?: string };
  return (
    err.name === "QuotaExceededError" ||
    /quota/i.test(err.message ?? "") ||
    /quota/i.test(err.name ?? "")
  );
}

export function errorAmigable(e: unknown): string {
  if (esErrorQuota(e)) {
    return "Almacenamiento lleno. Exporta/Descarga pizarras y borra las viejas.";
  }
  if (e instanceof Error && /indexeddb|idb|database/i.test(e.message)) {
    return "IndexedDB no disponible (¿incógnito u otro perfil?). Usa la misma URL y perfil.";
  }
  return e instanceof Error
    ? e.message
    : "Error desconocido de almacenamiento.";
}

/** Pide al navegador que no evicte IndexedDB al cerrar/limpiar. Best-effort. */
export async function asegurarPersistencia(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage) {
      return false;
    }
    if (
      typeof navigator.storage.persisted === "function" &&
      (await navigator.storage.persisted())
    ) {
      return true;
    }
    if (typeof navigator.storage.persist === "function") {
      return await navigator.storage.persist();
    }
  } catch {
    // ignorar: no todos los navegadores lo soportan
  }
  return false;
}

export async function diagnosticoAlmacenamiento(): Promise<EstadoAlmacenamiento> {
  const origen =
    typeof window !== "undefined" ? window.location.origin : "desconocido";
  try {
    // prueba real de escritura/lectura en nuestro store
    const probe = "__probe__";
    await set(probe, 1, store);
    await del(probe, store);
  } catch (e) {
    return {
      disponible: false,
      persistido: false,
      quotaMB: null,
      usoMB: null,
      origen,
      mensaje: errorAmigable(e),
    };
  }
  let persistido = false;
  let quotaMB: number | null = null;
  let usoMB: number | null = null;
  try {
    persistido = !!(await navigator.storage?.persisted?.());
  } catch {
    persistido = false;
  }
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.quota) {
      quotaMB = Math.round(est.quota / 1024 / 1024);
    }
    if (est?.usage) {
      usoMB = Math.round((est.usage / 1024 / 1024) * 10) / 10;
    }
  } catch {
    // estimación no disponible
  }
  return {
    disponible: true,
    persistido,
    quotaMB,
    usoMB,
    origen,
    mensaje: persistido
      ? "Almacenamiento persistente activo."
      : "Activa persistencia para que no se borre al cerrar (ver botón).",
  };
}

function construirRegistro(
  api: ExcalidrawImperativeAPI,
  alumno: string,
  key: string,
  fechaISO: string,
): RegistroHistorial {
  const elements = api.getSceneElements();
  const files = api.getFiles();
  return {
    meta: {
      key,
      alumno: alumno.trim() || "Alumno",
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
}

export async function guardarPizarra(
  api: ExcalidrawImperativeAPI,
  alumno: string,
  ficha?: FichaSesion,
): Promise<PizarraGuardada> {
  const nombre = sanitizeNombre(alumno) || "Alumno";
  const fechaISO = new Date().toISOString();
  const key = `${PREFIJO}${nombre}/${fechaISO.replace(/[:.]/g, "-")}`;
  const registro = construirRegistro(api, alumno, key, fechaISO);
  if (ficha) {
    if (ficha.materia.trim()) {
      registro.meta.materia = ficha.materia.trim();
    }
    if (ficha.temas.trim()) {
      registro.meta.temas = ficha.temas.trim();
    }
    if (ficha.sesion.trim()) {
      registro.meta.sesion = ficha.sesion.trim();
    }
    if (ficha.fecha.trim()) {
      registro.meta.fechaSesion = ficha.fecha.trim();
    }
  }
  try {
    await set(key, registro, store);
  } catch (e) {
    throw new Error(errorAmigable(e));
  }
  return registro.meta;
}

/** Autosave silencioso de la sesión actual (no aparece en la lista). */
export async function guardarUltimaSesion(
  api: ExcalidrawImperativeAPI,
  alumno: string,
): Promise<void> {
  // no guardar canvas vacío para no pisar una sesión útil con nada
  if (api.getSceneElements().length === 0) {
    return;
  }
  const fechaISO = new Date().toISOString();
  const registro = construirRegistro(api, alumno, ULTIMA_SESION_KEY, fechaISO);
  registro.meta.alumno = alumno.trim() || "Última sesión";
  try {
    await set(ULTIMA_SESION_KEY, registro, store);
  } catch {
    // autosave best-effort: nunca debe romper la clase
  }
}

export async function obtenerUltimaSesion(): Promise<
  RegistroHistorial | undefined
> {
  try {
    return await get<RegistroHistorial>(ULTIMA_SESION_KEY, store);
  } catch {
    return undefined;
  }
}

export async function borrarUltimaSesion(): Promise<void> {
  try {
    await del(ULTIMA_SESION_KEY, store);
  } catch {
    // best-effort
  }
}

export async function listarPizarras(): Promise<PizarraGuardada[]> {
  let todas: unknown[];
  try {
    todas = await keys(store);
  } catch (e) {
    throw new Error(errorAmigable(e));
  }
  const metas: PizarraGuardada[] = [];
  for (const k of todas) {
    if (typeof k !== "string" || !k.startsWith(PREFIJO)) {
      continue;
    }
    try {
      const reg = await get<RegistroHistorial>(k, store);
      if (reg?.meta) {
        metas.push(reg.meta);
      }
    } catch {
      // registro corrupto: se salta sin tumbar toda la lista
      continue;
    }
  }
  metas.sort((a, b) => (a.fechaISO < b.fechaISO ? 1 : -1));
  return metas;
}

export async function cargarPizarra(api: ExcalidrawImperativeAPI, key: string) {
  let reg: RegistroHistorial | undefined;
  try {
    reg = await get<RegistroHistorial>(key, store);
  } catch (e) {
    throw new Error(errorAmigable(e));
  }
  if (!reg) {
    throw new Error(
      "No se encontró la pizarra. ¿Cambiaste de navegador, perfil o URL (localhost vs Vercel)? El historial vive en esta URL y este perfil.",
    );
  }
  aplicarEscena(api, reg.escena.elements, reg.escena.files);
}

function aplicarEscena(
  api: ExcalidrawImperativeAPI,
  elements: unknown[],
  files: Record<string, unknown> | undefined,
) {
  const archivos = Object.values(files ?? {});
  if (archivos.length > 0) {
    api.addFiles(
      archivos as Parameters<ExcalidrawImperativeAPI["addFiles"]>[0],
    );
  }
  const elementos = convertToExcalidrawElements(
    elements as Parameters<typeof convertToExcalidrawElements>[0],
    { regenerateIds: false },
  );
  api.updateScene({
    elements: elementos,
    appState: {
      selectedElementIds: {},
    },
  });
}

/** Carga un .excalidraw (o el JSON de Descargar/Exportar) sobre el canvas. */
export function importarEscenaDesdeObjeto(
  api: ExcalidrawImperativeAPI,
  escena: { elements?: unknown[]; files?: Record<string, unknown> },
): number {
  const elements = escena.elements ?? [];
  aplicarEscena(api, elements, escena.files);
  return elements.length;
}

export async function borrarPizarra(key: string) {
  try {
    await del(key, store);
  } catch (e) {
    throw new Error(errorAmigable(e));
  }
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
    a.download = nombreArchivoFicha(meta);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
}

export async function obtenerRegistro(key: string) {
  try {
    return get<RegistroHistorial>(key, store);
  } catch {
    return undefined;
  }
}

export interface RespaldoTodo {
  version: 1;
  app: "excalidraw-clases";
  exportadoEn: string;
  origen: string;
  registros: RegistroHistorial[];
}

/** Respaldo completo para migrar de navegador/PC. Excluye ultima-sesion. */
export async function exportarTodo(): Promise<RespaldoTodo> {
  const pizarras = await listarPizarras();
  const registros: RegistroHistorial[] = [];
  for (const p of pizarras) {
    const reg = await obtenerRegistro(p.key);
    if (reg) {
      registros.push(reg);
    }
  }
  return {
    version: 1,
    app: "excalidraw-clases",
    exportadoEn: new Date().toISOString(),
    origen: typeof window !== "undefined" ? window.location.origin : "",
    registros,
  };
}

export function descargarRespaldoTodo(respaldo: RespaldoTodo) {
  const blob = new Blob([JSON.stringify(respaldo, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `respaldo-pizarras_${respaldo.exportadoEn.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Restaura un respaldo de exportarTodo(). Devuelve cuántas pizarras importó. */
export async function importarRespaldoTodo(datos: unknown): Promise<number> {
  const b = datos as Partial<RespaldoTodo>;
  if (!b || b.app !== "excalidraw-clases" || !Array.isArray(b.registros)) {
    throw new Error("Archivo de respaldo inválido.");
  }
  let n = 0;
  for (const reg of b.registros) {
    if (!reg?.meta?.key || !reg?.escena) {
      continue;
    }
    // solo acepta claves de nuestro prefijo por seguridad
    if (!reg.meta.key.startsWith(PREFIJO)) {
      continue;
    }
    await set(reg.meta.key, reg, store);
    n += 1;
  }
  return n;
}
