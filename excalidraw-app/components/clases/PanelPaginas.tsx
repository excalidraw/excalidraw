// Panel de páginas de clase (estilo Zoom Whiteboard / OneNote).
//
// Solo páginas: una lista con nombres, un clic para saltar a la página
// en pantalla completa, y un botón para crear páginas nuevas. No se
// menciona "frame" en la pantalla: esa palabra solo vive en paginas.ts.
//
// Aditivo: este componente no modifica ningún feature existente. Se
// renderiza junto al Panel de clase, en el lado izquierdo, y se puede
// plegar para dejar la pizarra libre.

import { useEffect, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  crearPagina,
  crearPaginasClase,
  irAPagina,
  listarPaginas,
  PAGINAS_CLASE,
  renombrarPagina,
} from "./paginas";
import type { Pagina } from "./paginas";

const ANCHO_PANEL = 260;

const panelStyle: React.CSSProperties = {
  position: "fixed",
  top: 72,
  left: 12,
  width: ANCHO_PANEL,
  maxHeight: "calc(100vh - 150px)",
  overflowY: "auto",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
  zIndex: 8000,
  fontFamily: "system-ui, sans-serif",
  padding: "12px 12px 14px",
};

const botonPaginaStyle = (activa: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  textAlign: "left",
  padding: "8px 10px",
  marginBottom: 6,
  border: activa ? "2px solid #1d4ed8" : "1px solid #e5e7eb",
  borderRadius: 8,
  background: activa ? "#eff6ff" : "#fff",
  color: "#1e1e1e",
  fontSize: 14,
  cursor: "pointer",
});

export const PanelPaginas: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI;
}> = ({ excalidrawAPI }) => {
  const [abierto, setAbierto] = useState(true);
  const [paginas, setPaginas] = useState<Pagina[]>(() =>
    listarPaginas(excalidrawAPI),
  );
  const [activaId, setActivaId] = useState<string | null>(null);
  const [nueva, setNueva] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoNombre, setEditandoNombre] = useState("");

  const refrescar = () => {
    const lista = listarPaginas(excalidrawAPI);
    setPaginas(lista);
    setActivaId((actual) =>
      actual && lista.some((p) => p.id === actual) ? actual : null,
    );
  };

  // La lista se refresca sola mientras el panel está abierto: así recoge
  // páginas creadas, renombradas o cargadas desde otra pizarra guardada,
  // sin tocar el resto de la aplicación.
  useEffect(() => {
    if (!abierto) {
      return;
    }
    refrescar();
    const id = window.setInterval(refrescar, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, excalidrawAPI]);

  const mostrarAviso = (texto: string) => {
    setAviso(texto);
    window.setTimeout(() => setAviso(null), 3000);
  };

  const saltar = (pagina: Pagina) => {
    irAPagina(excalidrawAPI, pagina);
    setActivaId(pagina.id);
  };

  const saltarVecina = (paso: 1 | -1) => {
    if (paginas.length === 0) {
      return;
    }
    const idx = paginas.findIndex((p) => p.id === activaId);
    const siguiente = paginas[Math.min(Math.max(idx + paso, 0), paginas.length - 1)];
    if (siguiente) {
      saltar(siguiente);
    }
  };

  const crearClase = () => {
    const creadas = crearPaginasClase(excalidrawAPI);
    refrescar();
    if (creadas.length === 0) {
      mostrarAviso("Ya tienes las 4 páginas de clase.");
    } else {
      setActivaId(creadas[0].id);
      mostrarAviso(`Creadas: ${creadas.map((p) => p.nombre).join(", ")}.`);
    }
  };

  const crearNueva = () => {
    const pagina = crearPagina(excalidrawAPI, nueva);
    setNueva("");
    refrescar();
    if (pagina) {
      setActivaId(pagina.id);
    } else {
      mostrarAviso("No se pudo crear la página.");
    }
  };

  const guardarNombre = () => {
    if (!editandoId) {
      return;
    }
    renombrarPagina(excalidrawAPI, editandoId, editandoNombre);
    setEditandoId(null);
    setEditandoNombre("");
    refrescar();
  };

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        style={{
          position: "fixed",
          top: 72,
          left: 12,
          zIndex: 8000,
          padding: "8px 12px",
          borderRadius: 999,
          border: "1px solid #e5e7eb",
          background: "#fff",
          boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
          fontSize: 14,
          cursor: "pointer",
        }}
        aria-label="Mostrar páginas"
      >
        📄 Páginas
      </button>
    );
  }

  const faltanClase = PAGINAS_CLASE.filter(
    (titulo) =>
      !paginas.some((p) => p.nombre.toLowerCase() === titulo.toLowerCase()),
  );

  return (
    <div style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <strong style={{ fontSize: 15 }}>📄 Páginas</strong>
        <button
          onClick={() => setAbierto(false)}
          style={{
            border: "none",
            background: "transparent",
            fontSize: 18,
            cursor: "pointer",
            color: "#6b7280",
          }}
          aria-label="Ocultar páginas"
        >
          ×
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>
        Toca una página para saltar a ella. Sin scroll.
      </p>

      {paginas.length === 0 ? (
        <p style={{ fontSize: 13, color: "#4b5563", margin: "0 0 10px" }}>
          Todavía no hay páginas. Crea las 4 de clase o una página nueva.
        </p>
      ) : (
        <div style={{ marginBottom: 10 }}>
          {paginas.map((pagina, i) => (
            <div key={pagina.id}>
              {editandoId === pagina.id ? (
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <input
                    value={editandoNombre}
                    onChange={(e) => setEditandoNombre(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        guardarNombre();
                      }
                      if (e.key === "Escape") {
                        setEditandoId(null);
                      }
                    }}
                    autoFocus
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: "7px 8px",
                      border: "1px solid #1d4ed8",
                      borderRadius: 8,
                      fontSize: 14,
                    }}
                    aria-label="Nuevo nombre de la página"
                  />
                  <button
                    onClick={guardarNombre}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 8,
                      border: "none",
                      background: "#1d4ed8",
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => saltar(pagina)}
                  style={botonPaginaStyle(activaId === pagina.id)}
                >
                  <span
                    style={{
                      minWidth: 22,
                      height: 22,
                      borderRadius: 999,
                      background: "#03045e",
                      color: "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ flex: 1 }}>{pagina.nombre}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    title="Cambiar nombre"
                    aria-label={`Cambiar nombre de ${pagina.nombre}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditandoId(pagina.id);
                      setEditandoNombre(pagina.nombre);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        setEditandoId(pagina.id);
                        setEditandoNombre(pagina.nombre);
                      }
                    }}
                    style={{ color: "#6b7280", fontSize: 14, cursor: "pointer" }}
                  >
                    ✎
                  </span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button
          onClick={() => saltarVecina(-1)}
          disabled={paginas.length === 0}
          style={{
            flex: 1,
            padding: "8px 6px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          ← Anterior
        </button>
        <button
          onClick={() => saltarVecina(1)}
          disabled={paginas.length === 0}
          style={{
            flex: 1,
            padding: "8px 6px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Siguiente →
        </button>
      </div>

      <button
        onClick={crearClase}
        style={{
          width: "100%",
          padding: "10px 8px",
          marginBottom: 8,
          borderRadius: 8,
          border: "none",
          background: "#03045e",
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Crear las 4 páginas de clase
      </button>
      {faltanClase.length > 0 && paginas.length > 0 && (
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>
          Faltan: {faltanClase.join(", ")}.
        </p>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              crearNueva();
            }
          }}
          placeholder="Nombre de la página nueva"
          style={{
            flex: 1,
            minWidth: 0,
            padding: "8px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            fontSize: 14,
          }}
          aria-label="Nombre de la página nueva"
        />
        <button
          onClick={crearNueva}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "none",
            background: "#1d4ed8",
            color: "#fff",
            fontSize: 14,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          + Nueva
        </button>
      </div>

      {aviso && (
        <p style={{ fontSize: 12, color: "#1d4ed8", margin: "10px 0 0" }}>
          {aviso}
        </p>
      )}
      <p style={{ fontSize: 11, color: "#9ca3af", margin: "10px 0 0" }}>
        Las páginas se guardan con la pizarra. Para borrar una página,
        selecciónala en la pizarra y bórrala como cualquier elemento.
      </p>
    </div>
  );
};
