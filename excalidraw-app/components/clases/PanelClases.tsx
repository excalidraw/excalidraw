import { useCallback, useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { REGLAS } from "./datosReglas";
import { FIGURAS } from "./datosFiguras";
import "./cursores.css";
import {
  generarEjercicios,
  guardarClave,
  guardarModelo,
  leerClave,
  leerModelo,
  MODELO_DEFAULT,
} from "./asistente";

import { beep, FASES, formatear } from "./temporizador";
import {
  construirEncabezado,
  fechaHoy,
  fichaVacia,
  resumenFicha,
} from "./ficha";

import {
  insertarSkeletons,
  insertarTexto,
  origenViewport,
  pantallaAScena,
} from "./insertar";
import {
  asegurarPersistencia,
  borrarPizarra,
  borrarUltimaSesion,
  cargarPizarra,
  descargarPizarra,
  descargarRespaldoTodo,
  diagnosticoAlmacenamiento,
  errorAmigable,
  exportarTodo,
  guardarPizarra,
  guardarUltimaSesion,
  importarEscenaDesdeObjeto,
  importarRespaldoTodo,
  listarPizarras,
  obtenerRegistro,
  obtenerUltimaSesion,
} from "./historial";

import type { FichaSesion } from "./ficha";

import type { ResultadoEjercicios } from "./asistente";

import type { EstadoAlmacenamiento, PizarraGuardada } from "./historial";

/** Evento para abrir/cerrar el panel desde el menú principal. */
export const PANEL_EVENT = "excalidraw-clases:panel";
const DROP_MIME = "application/x-clase-item";

type Tab = "reglas" | "figuras" | "tools" | "historial" | "ia" | "ficha";

interface ItemArrastrable {
  kind: "regla" | "figura";
  titulo: string;
  texto?: string;
  color?: string;
  figuraId?: string;
}

type PresetState = Pick<
  AppState,
  | "activeTool"
  | "currentItemStrokeColor"
  | "currentItemStrokeWidthKey"
  | "currentItemOpacity"
  | "currentItemFontSize"
>;

const NEUTRO = {
  currentItemStrokeColor: "#1e1e1e",
  currentItemStrokeWidthKey: "medium",
  currentItemOpacity: 100,
  currentItemFontSize: 20,
} as const;

const PRESETS: Array<{
  id: string;
  nombre: string;
  hint: string;
  appState: PresetState;
}> = [
  {
    id: "resaltador",
    nombre: "Resaltador",
    hint: "Lápiz grueso amarillo",
    appState: {
      ...NEUTRO,
      activeTool: {
        type: "freedraw",
        customType: null,
        locked: false,
        fromSelection: false,
        lastActiveTool: null,
      },
      currentItemStrokeColor: "#eab308",
      currentItemStrokeWidthKey: "bold",
      currentItemOpacity: 60,
    },
  },
  {
    id: "texto-grande",
    nombre: "Texto grande",
    hint: "Títulos legibles",
    appState: {
      ...NEUTRO,
      activeTool: {
        type: "text",
        customType: null,
        locked: false,
        fromSelection: false,
        lastActiveTool: null,
      },
      currentItemFontSize: 36,
    },
  },
  {
    id: "lapiz-fino",
    nombre: "Lápiz fino",
    hint: "Trazo preciso negro",
    appState: {
      ...NEUTRO,
      activeTool: {
        type: "freedraw",
        customType: null,
        locked: false,
        fromSelection: false,
        lastActiveTool: null,
      },
      currentItemStrokeWidthKey: "thin",
    },
  },
  {
    id: "goma",
    nombre: "Goma",
    hint: "Borrar",
    appState: {
      ...NEUTRO,
      activeTool: {
        type: "eraser",
        customType: null,
        locked: false,
        fromSelection: false,
        lastActiveTool: null,
      },
    },
  },
];

const panelStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  width: 320,
  height: "100vh",
  background: "#fff",
  borderLeft: "1px solid #e5e7eb",
  boxShadow: "-4px 0 16px rgba(0,0,0,0.08)",
  zIndex: 9000,
  display: "flex",
  flexDirection: "column",
  fontFamily: "system-ui, sans-serif",
};

const tabStyle = (activa: boolean): React.CSSProperties => ({
  flex: 1,
  padding: "8px 4px",
  fontSize: 12,
  fontWeight: activa ? 700 : 400,
  background: activa ? "#eff6ff" : "transparent",
  color: activa ? "#1d4ed8" : "#4b5563",
  border: "none",
  borderBottom: activa ? "2px solid #1d4ed8" : "2px solid transparent",
  cursor: "pointer",
});

export const PanelClases: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI;
}> = ({ excalidrawAPI }) => {
  const [abierto, setAbierto] = useState(false);
  const [tab, setTab] = useState<Tab>("reglas");
  const [gradoIdx, setGradoIdx] = useState(2);
  const [alumno, setAlumno] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pizarras, setPizarras] = useState<PizarraGuardada[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);
  const [almacen, setAlmacen] = useState<EstadoAlmacenamiento | null>(null);
  const [ultimaSesion, setUltimaSesion] = useState<{
    alumno: string;
    fechaISO: string;
    numElementos: number;
  } | null>(null);
  const importarTodoRef = useRef<HTMLInputElement>(null);
  const importarEscenaRef = useRef<HTMLInputElement>(null);
  const [cursorLapiz, setCursorLapiz] = useState(() => {
    try {
      return localStorage.getItem("clases:cursor-lapiz") !== "off";
    } catch {
      return true;
    }
  });
  // Asistente IA (OpenRouter BYOK)
  const [apiKey, setApiKey] = useState(() => leerClave());
  const [modelo, setModelo] = useState(() => leerModelo());
  const [gradoIA, setGradoIA] = useState("8");
  const [temaIA, setTemaIA] = useState("");
  const [cantidadIA, setCantidadIA] = useState(5);
  const [dificultadIA, setDificultadIA] = useState<
    "fácil" | "media" | "difícil"
  >("media");
  const [conSolucionario, setConSolucionario] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [resultadoIA, setResultadoIA] = useState<ResultadoEjercicios | null>(
    null,
  );
  const [errorIA, setErrorIA] = useState<string | null>(null);
  const [verSoluciones, setVerSoluciones] = useState(false);
  // Temporizador de clase
  const [faseId, setFaseId] = useState(FASES[0].id);
  const [minLibres, setMinLibres] = useState(10);
  const [restantes, setRestantes] = useState<number | null>(null);
  const [corriendo, setCorriendo] = useState(false);
  // Ficha de sesión
  const [ficha, setFicha] = useState<FichaSesion>(() => fichaVacia());
  const alumnoRef = useRef("");
  alumnoRef.current = alumno;
  const cascadaRef = useRef(0);

  useEffect(() => {
    const toggle = () => setAbierto((v) => !v);
    window.addEventListener(PANEL_EVENT, toggle);
    return () => window.removeEventListener(PANEL_EVENT, toggle);
  }, []);

  // Cursor lápiz estético: clase global en <body>, con preferencia guardada.
  useEffect(() => {
    document.body.classList.toggle("clases-cursor-lapiz", cursorLapiz);
    try {
      localStorage.setItem("clases:cursor-lapiz", cursorLapiz ? "on" : "off");
    } catch {
      // best-effort
    }
  }, [cursorLapiz]);

  // Temporizador: cuenta regresiva con pitido al llegar a cero.
  useEffect(() => {
    if (!corriendo || restantes === null) {
      return;
    }
    if (restantes <= 0) {
      setCorriendo(false);
      beep();
      setAviso("Tiempo terminado.");
      window.setTimeout(() => setAviso(null), 3000);
      return;
    }
    const id = window.setTimeout(
      () => setRestantes((r) => (r === null ? r : r - 1)),
      1000,
    );
    return () => window.clearTimeout(id);
  }, [corriendo, restantes]);

  const refrescarHistorial = useCallback(async () => {
    try {
      setErrorHistorial(null);
      setPizarras(await listarPizarras());
    } catch (e) {
      setErrorHistorial(errorAmigable(e));
    }
  }, []);

  const refrescarDiagnostico = useCallback(async () => {
    try {
      setAlmacen(await diagnosticoAlmacenamiento());
    } catch {
      // best-effort
    }
    try {
      const ultima = await obtenerUltimaSesion();
      setUltimaSesion(ultima ? ultima.meta : null);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    if (abierto && tab === "historial") {
      refrescarHistorial();
      refrescarDiagnostico();
    }
  }, [abierto, tab, refrescarHistorial, refrescarDiagnostico]);

  // Autosave de la sesión actual cada 30s + al cerrar, para recuperar
  // la pizarra si se cierra el browser sin guardar con nombre.
  useEffect(() => {
    const guardar = () => {
      try {
        void guardarUltimaSesion(excalidrawAPI, alumnoRef.current);
      } catch {
        // best-effort
      }
    };
    const id = window.setInterval(guardar, 30000);
    window.addEventListener("beforeunload", guardar);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("beforeunload", guardar);
    };
  }, [excalidrawAPI]);

  const mostrarAviso = (texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso(null), 3000);
  };

  const siguienteCascada = () => {
    cascadaRef.current = (cascadaRef.current + 1) % 8;
    return cascadaRef.current * 40;
  };

  const pegarRegla = useCallback(
    (
      gradoColor: string,
      titulo: string,
      texto: string,
      at?: { x: number; y: number },
    ) => {
      const bloque = `${titulo.toUpperCase()}\n${texto}`;
      if (at) {
        insertarSkeletons(
          excalidrawAPI,
          [
            {
              type: "text",
              text: bloque,
              fontSize: 24,
              strokeColor: gradoColor,
            } as never,
          ],
          at.x,
          at.y,
        );
      } else {
        const d = siguienteCascada();
        insertarTexto(excalidrawAPI, bloque, {
          fontSize: 24,
          strokeColor: gradoColor,
          dx: d,
          dy: d,
        });
      }
    },
    [excalidrawAPI],
  );

  const pegarFigura = useCallback(
    (figuraId: string, at?: { x: number; y: number }) => {
      const figura = FIGURAS.find((f) => f.id === figuraId);
      if (!figura) {
        return;
      }
      const skeletons = figura.construir();
      if (at) {
        insertarSkeletons(excalidrawAPI, skeletons, at.x, at.y);
      } else {
        const { x, y } = origenViewport(excalidrawAPI);
        const d = siguienteCascada();
        insertarSkeletons(excalidrawAPI, skeletons, x + d, y + d);
      }
      mostrarAviso(`${figura.nombre} insertada.`);
    },
    [excalidrawAPI],
  );

  // Drop de tarjetas del panel sobre el canvas (con posicionamiento)
  useEffect(() => {
    if (!abierto) {
      return;
    }
    const alArrastrar = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes(DROP_MIME)) {
        e.preventDefault();
      }
    };
    const alSoltar = (e: DragEvent) => {
      const raw = e.dataTransfer?.getData(DROP_MIME);
      if (!raw) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      try {
        const item = JSON.parse(raw) as ItemArrastrable;
        const at = pantallaAScena(excalidrawAPI, e.clientX, e.clientY);
        if (item.kind === "regla" && item.texto) {
          pegarRegla(item.color || "#1e1e1e", item.titulo, item.texto, at);
        } else if (item.kind === "figura" && item.figuraId) {
          pegarFigura(item.figuraId, at);
        }
      } catch {
        // payload inválido: ignorar
      }
    };
    document.addEventListener("dragover", alArrastrar, true);
    document.addEventListener("drop", alSoltar, true);
    return () => {
      document.removeEventListener("dragover", alArrastrar, true);
      document.removeEventListener("drop", alSoltar, true);
    };
  }, [abierto, excalidrawAPI, pegarRegla, pegarFigura]);

  const iniciarArrastre = (e: React.DragEvent, item: ItemArrastrable) => {
    e.dataTransfer.setData(DROP_MIME, JSON.stringify(item));
    e.dataTransfer.effectAllowed = "copy";
  };

  const aplicarPreset = (preset: typeof PRESETS[number]) => {
    excalidrawAPI.updateScene({
      appState: { ...preset.appState },
    });
    mostrarAviso(`${preset.nombre} activado.`);
  };

  const handleGuardar = async () => {
    if (!alumno.trim()) {
      mostrarAviso("Escribe el nombre del alumno primero.");
      return;
    }
    try {
      const meta = await guardarPizarra(excalidrawAPI, alumno.trim());
      setAlumno("");
      refrescarHistorial();
      mostrarAviso(`Pizarra de ${meta.alumno} guardada.`);
    } catch (e) {
      mostrarAviso(errorAmigable(e));
    }
  };

  const handlePersistencia = async () => {
    const ok = await asegurarPersistencia();
    await refrescarDiagnostico();
    mostrarAviso(
      ok ? "Persistencia activada." : "El navegador no concedió persistencia.",
    );
  };

  const handleRecuperarUltima = async () => {
    try {
      const ultima = await obtenerUltimaSesion();
      if (!ultima) {
        mostrarAviso("No hay última sesión.");
        return;
      }
      await cargarPizarra(excalidrawAPI, "ultima-sesion");
      mostrarAviso("Última sesión recuperada.");
    } catch (e) {
      mostrarAviso(errorAmigable(e));
    }
  };

  const handleDescartarUltima = async () => {
    await borrarUltimaSesion();
    setUltimaSesion(null);
  };

  const handleExportarTodo = async () => {
    try {
      descargarRespaldoTodo(await exportarTodo());
      mostrarAviso("Respaldo descargado.");
    } catch (e) {
      mostrarAviso(errorAmigable(e));
    }
  };

  const leerArchivo = (file: File): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        try {
          resolve(JSON.parse(String(r.result)));
        } catch {
          reject(new Error("Archivo JSON inválido."));
        }
      };
      r.onerror = () => reject(new Error("No se pudo leer el archivo."));
      r.readAsText(file);
    });

  const handleGenerar = async () => {
    setGenerando(true);
    setErrorIA(null);
    try {
      guardarClave(apiKey);
      guardarModelo(modelo);
      const res = await generarEjercicios(
        {
          grado: gradoIA,
          tema: temaIA,
          cantidad: cantidadIA,
          dificultad: dificultadIA,
          conSolucionario,
        },
        apiKey,
        modelo || MODELO_DEFAULT,
      );
      setResultadoIA(res);
      setVerSoluciones(false);
      mostrarAviso(`${res.ejercicios.length} ejercicios generados.`);
    } catch (e) {
      setErrorIA(e instanceof Error ? e.message : "Error generando.");
    } finally {
      setGenerando(false);
    }
  };

  const insertarEjercicio = (texto: string, indice: number) => {
    const d = (cascadaRef.current + indice) % 8;
    insertarTexto(excalidrawAPI, `${indice + 1}. ${texto}`, {
      fontSize: 24,
      dx: d * 40,
      dy: d * 40,
    });
    mostrarAviso(`Ejercicio ${indice + 1} insertado.`);
  };

  const insertarTodos = () => {
    if (!resultadoIA) {
      return;
    }
    resultadoIA.ejercicios.forEach((texto, i) => {
      const d = (cascadaRef.current + i) % 8;
      insertarTexto(excalidrawAPI, `${i + 1}. ${texto}`, {
        fontSize: 24,
        dx: d * 40,
        dy: d * 40,
      });
    });
    cascadaRef.current =
      (cascadaRef.current + resultadoIA.ejercicios.length) % 8;
    mostrarAviso(`${resultadoIA.ejercicios.length} ejercicios insertados.`);
  };

  const iniciarTimer = (minutos: number) => {
    setRestantes(Math.round(minutos * 60));
    setCorriendo(true);
  };

  const setCampoFicha = (campo: keyof FichaSesion, valor: string) => {
    setFicha((f) => ({ ...f, [campo]: valor }));
  };

  const handleInsertarEncabezado = () => {
    if (!ficha.alumno.trim()) {
      mostrarAviso("Escribe el estudiante en la ficha primero.");
      return;
    }
    const { x, y } = origenViewport(excalidrawAPI);
    insertarSkeletons(excalidrawAPI, construirEncabezado(ficha), x, y);
    mostrarAviso("Encabezado insertado.");
  };

  const handleGuardarConFicha = async () => {
    if (!ficha.alumno.trim()) {
      mostrarAviso("Escribe el estudiante en la ficha primero.");
      return;
    }
    try {
      const meta = await guardarPizarra(
        excalidrawAPI,
        ficha.alumno.trim(),
        ficha,
      );
      refrescarHistorial();
      mostrarAviso(`Pizarra de ${meta.alumno} guardada con ficha.`);
    } catch (e) {
      mostrarAviso(errorAmigable(e));
    }
  };

  const handleNuevaSesion = async () => {
    if (!ficha.alumno.trim()) {
      mostrarAviso("Escribe el estudiante en la ficha primero.");
      return;
    }
    if (
      !confirm(
        "Esto guarda la sesión actual en autosave y limpia la pizarra. ¿Seguir?",
      )
    ) {
      return;
    }
    try {
      await guardarUltimaSesion(excalidrawAPI, ficha.alumno.trim());
    } catch {
      // best-effort
    }
    excalidrawAPI.updateScene({ elements: [] });
    const { x, y } = origenViewport(excalidrawAPI);
    insertarSkeletons(excalidrawAPI, construirEncabezado(ficha), x, y);
    setFicha((f) => ({ ...f, fecha: fechaHoy() }));
    mostrarAviso("Nueva sesión lista.");
  };

  if (!abierto) {
    return null;
  }

  const grado = REGLAS[gradoIdx];
  const pizarrasFiltradas = pizarras.filter((p) =>
    `${p.alumno}`.toLowerCase().includes(busqueda.toLowerCase()),
  );

  return (
    <div style={panelStyle}>
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong style={{ fontSize: 14 }}>Panel de clase</strong>
        <button
          onClick={() => setAbierto(false)}
          style={{
            border: "none",
            background: "transparent",
            fontSize: 18,
            cursor: "pointer",
            color: "#6b7280",
          }}
          aria-label="Cerrar panel"
        >
          ×
        </button>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }}>
        <button
          style={tabStyle(tab === "reglas")}
          onClick={() => setTab("reglas")}
        >
          Reglas
        </button>
        <button
          style={tabStyle(tab === "figuras")}
          onClick={() => setTab("figuras")}
        >
          Figuras
        </button>
        <button
          style={tabStyle(tab === "tools")}
          onClick={() => setTab("tools")}
        >
          Tools
        </button>
        <button
          style={tabStyle(tab === "historial")}
          onClick={() => setTab("historial")}
        >
          Historial
        </button>
        <button style={tabStyle(tab === "ia")} onClick={() => setTab("ia")}>
          IA
        </button>
        <button
          style={tabStyle(tab === "ficha")}
          onClick={() => setTab("ficha")}
        >
          Ficha
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {tab === "reglas" && (
          <div>
            <select
              value={gradoIdx}
              onChange={(e) => setGradoIdx(Number(e.target.value))}
              style={{
                width: "100%",
                padding: 8,
                marginBottom: 10,
                borderRadius: 8,
                border: "1px solid #d1d5db",
              }}
            >
              {REGLAS.map((g, i) => (
                <option key={g.grado} value={i}>
                  Grado {g.grado} — {g.nombre}
                </option>
              ))}
            </select>
            {grado.temas.map((tema) => (
              <div key={tema.titulo} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    background: grado.color,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "6px 10px",
                    borderRadius: "8px 8px 0 0",
                  }}
                >
                  {tema.titulo}
                </div>
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderTop: "none",
                    borderRadius: "0 0 8px 8px",
                    padding: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {tema.reglas.map((regla, ri) => (
                    <div
                      key={ri}
                      draggable
                      onDragStart={(e) =>
                        iniciarArrastre(e, {
                          kind: "regla",
                          titulo: `${grado.nombre} · ${tema.titulo}`,
                          texto: regla,
                          color: grado.color,
                        })
                      }
                      onClick={() => {
                        pegarRegla(
                          grado.color,
                          `${grado.nombre} · ${tema.titulo}`,
                          regla,
                        );
                        mostrarAviso(
                          "Regla insertada (o arrástrala al punto exacto).",
                        );
                      }}
                      title="Clic para insertar o arrastra al canvas"
                      style={{
                        fontSize: 12,
                        background: "#f9fafb",
                        border: "1px dashed #d1d5db",
                        borderRadius: 6,
                        padding: "6px 8px",
                        cursor: "grab",
                      }}
                    >
                      {regla}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "figuras" && (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            {FIGURAS.map((figura) => (
              <div
                key={figura.id}
                draggable
                onDragStart={(e) =>
                  iniciarArrastre(e, {
                    kind: "figura",
                    titulo: figura.nombre,
                    figuraId: figura.id,
                  })
                }
                onClick={() => pegarFigura(figura.id)}
                title="Clic para insertar o arrastra al canvas"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  background: "#f9fafb",
                  border: "1px dashed #d1d5db",
                  borderRadius: 8,
                  padding: "14px 8px",
                  cursor: "grab",
                  textAlign: "center",
                }}
              >
                {figura.nombre}
              </div>
            ))}
          </div>
        )}

        {tab === "tools" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => aplicarPreset(preset)}
                style={{
                  textAlign: "left",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: "10px 12px",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {preset.nombre}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  {preset.hint}
                </div>
              </button>
            ))}
            <p style={{ fontSize: 11, color: "#6b7280" }}>
              Los presets cambian el tool activo y su estilo de un toque.
            </p>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "10px 12px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={cursorLapiz}
                onChange={(e) => setCursorLapiz(e.target.checked)}
              />
              <span>
                <span style={{ fontWeight: 700 }}>Cursor lápiz ✏️</span>
                <br />
                <span style={{ fontSize: 11, color: "#6b7280" }}>
                  Solo estética, no cambia el trazo.
                </span>
              </span>
            </label>
            <div
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                Temporizador ⏱{" "}
                {restantes !== null && (
                  <span
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      color:
                        restantes <= 60 && corriendo ? "#b91c1c" : "#1d4ed8",
                    }}
                  >
                    {formatear(restantes)}
                  </span>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 8,
                  flexWrap: "wrap",
                }}
              >
                {FASES.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setFaseId(f.id);
                      iniciarTimer(f.minutos);
                    }}
                    style={{
                      fontSize: 11,
                      fontWeight: faseId === f.id && corriendo ? 700 : 400,
                      background:
                        faseId === f.id && corriendo ? "#dbeafe" : "#fff",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      padding: "4px 8px",
                      cursor: "pointer",
                    }}
                  >
                    {f.nombre} {f.minutos}&apos;
                  </button>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 8,
                  alignItems: "center",
                }}
              >
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={minLibres}
                  onChange={(e) => setMinLibres(Number(e.target.value))}
                  style={{
                    width: 64,
                    padding: 6,
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    fontSize: 12,
                  }}
                  aria-label="Minutos libres"
                />
                <span style={{ fontSize: 11, color: "#6b7280" }}>min</span>
                <button
                  onClick={() => iniciarTimer(minLibres)}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: "#1d4ed8",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 10px",
                    cursor: "pointer",
                  }}
                >
                  Iniciar
                </button>
                {corriendo ? (
                  <button
                    onClick={() => setCorriendo(false)}
                    style={{
                      fontSize: 11,
                      background: "#fff",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      padding: "6px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Pausar
                  </button>
                ) : (
                  restantes !== null &&
                  restantes > 0 && (
                    <button
                      onClick={() => setCorriendo(true)}
                      style={{
                        fontSize: 11,
                        background: "#fff",
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        padding: "6px 10px",
                        cursor: "pointer",
                      }}
                    >
                      Seguir
                    </button>
                  )
                )}
                {restantes !== null && (
                  <button
                    onClick={() => {
                      setCorriendo(false);
                      setRestantes(null);
                    }}
                    style={{
                      fontSize: 11,
                      background: "transparent",
                      border: "none",
                      color: "#6b7280",
                      cursor: "pointer",
                    }}
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "ia" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              Asistente IA 🤖 (OpenRouter)
            </div>
            <label style={{ fontSize: 11, color: "#6b7280" }}>
              API key (solo vive en tu navegador)
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onBlur={() => guardarClave(apiKey)}
                placeholder="sk-or-…"
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 12,
                  marginTop: 4,
                  boxSizing: "border-box",
                }}
              />
            </label>
            <label style={{ fontSize: 11, color: "#6b7280" }}>
              Modelo
              <input
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                onBlur={() => guardarModelo(modelo)}
                placeholder={MODELO_DEFAULT}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 12,
                  marginTop: 4,
                  boxSizing: "border-box",
                }}
              />
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              <label style={{ fontSize: 11, color: "#6b7280", flex: 1 }}>
                Grado
                <select
                  value={gradoIA}
                  onChange={(e) => setGradoIA(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  {["7", "8", "9", "10", "11", "12"].map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 11, color: "#6b7280", flex: 1 }}>
                Cantidad
                <select
                  value={cantidadIA}
                  onChange={(e) => setCantidadIA(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  {[3, 5, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 11, color: "#6b7280", flex: 1 }}>
                Dificultad
                <select
                  value={dificultadIA}
                  onChange={(e) =>
                    setDificultadIA(
                      e.target.value as "fácil" | "media" | "difícil",
                    )
                  }
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  {["fácil", "media", "difícil"].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label style={{ fontSize: 11, color: "#6b7280" }}>
              Tema
              <input
                value={temaIA}
                onChange={(e) => setTemaIA(e.target.value)}
                placeholder="ej. ecuaciones lineales"
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 12,
                  marginTop: 4,
                  boxSizing: "border-box",
                }}
              />
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={conSolucionario}
                onChange={(e) => setConSolucionario(e.target.checked)}
              />
              Con solucionario (solo en el panel)
            </label>
            <button
              onClick={handleGenerar}
              disabled={generando}
              style={{
                background: generando ? "#93c5fd" : "#1d4ed8",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: generando ? "wait" : "pointer",
              }}
            >
              {generando ? "Generando…" : "Generar ejercicios"}
            </button>
            {errorIA && (
              <div
                style={{
                  fontSize: 11,
                  color: "#b91c1c",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: "8px 10px",
                }}
              >
                ⚠ {errorIA}
              </div>
            )}
            {resultadoIA && (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700 }}>
                    {resultadoIA.ejercicios.length} ejercicios
                  </span>
                  <button
                    onClick={insertarTodos}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      border: "1px solid #bfdbfe",
                      borderRadius: 6,
                      padding: "4px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Insertar todos
                  </button>
                </div>
                {resultadoIA.ejercicios.map((texto, i) => (
                  <div
                    key={i}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: 8,
                      marginBottom: 6,
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <strong>{i + 1}.</strong> {texto}
                    </div>
                    <button
                      onClick={() => insertarEjercicio(texto, i)}
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: "#f9fafb",
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        padding: "4px 8px",
                        cursor: "pointer",
                      }}
                    >
                      Insertar
                    </button>
                  </div>
                ))}
                {resultadoIA.soluciones.length > 0 && (
                  <div
                    style={{
                      border: "1px solid #fde68a",
                      background: "#fffbeb",
                      borderRadius: 8,
                      padding: 8,
                      fontSize: 12,
                    }}
                  >
                    <button
                      onClick={() => setVerSoluciones((v) => !v)}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      {verSoluciones
                        ? "Ocultar solucionario ▴"
                        : "Ver solucionario ▾ (no se inserta)"}
                    </button>
                    {verSoluciones && (
                      <div style={{ marginTop: 6 }}>
                        {resultadoIA.soluciones.map((s, i) => (
                          <div key={i} style={{ marginBottom: 4 }}>
                            <strong>{i + 1}.</strong> {s}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "ficha" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              Ficha de sesión 📋
            </div>
            {(
              [
                ["alumno", "Estudiante", "ej. Yoliannie Matos"],
                ["materia", "Materia", "ej. Matemática"],
                ["temas", "Tema(s)", "ej. Rango y dominio"],
              ] as Array<[keyof FichaSesion, string, string]>
            ).map(([campo, etiqueta, ejemplo]) => (
              <label key={campo} style={{ fontSize: 11, color: "#6b7280" }}>
                {etiqueta}
                <input
                  value={ficha[campo]}
                  onChange={(e) => setCampoFicha(campo, e.target.value)}
                  placeholder={ejemplo}
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 12,
                    marginTop: 4,
                    boxSizing: "border-box",
                  }}
                />
              </label>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <label style={{ fontSize: 11, color: "#6b7280", flex: 1 }}>
                Sesión #
                <input
                  value={ficha.sesion}
                  onChange={(e) => setCampoFicha("sesion", e.target.value)}
                  placeholder="ej. 3"
                  inputMode="numeric"
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 12,
                    marginTop: 4,
                    boxSizing: "border-box",
                  }}
                />
              </label>
              <label style={{ fontSize: 11, color: "#6b7280", flex: 1 }}>
                Fecha
                <input
                  type="date"
                  value={ficha.fecha}
                  onChange={(e) => setCampoFicha("fecha", e.target.value)}
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 12,
                    marginTop: 4,
                    boxSizing: "border-box",
                  }}
                />
              </label>
            </div>
            <button
              onClick={handleInsertarEncabezado}
              style={{
                background: "#f9fafb",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Insertar encabezado
            </button>
            <button
              onClick={handleGuardarConFicha}
              style={{
                background: "#1d4ed8",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Guardar pizarra con ficha
            </button>
            <button
              onClick={handleNuevaSesion}
              style={{
                background: "#fff",
                border: "1px solid #1d4ed8",
                color: "#1d4ed8",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Nueva sesión desde ficha
            </button>
            <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>
              El encabezado queda fijo arriba de la pizarra y sale en el
              PNG/PDF. El archivo se descarga como
              Pizarra_Estudiante_S#_Materia_fecha.
            </p>
          </div>
        )}

        {tab === "historial" && (
          <div>
            {almacen && (
              <div
                style={{
                  fontSize: 11,
                  color: almacen.disponible ? "#065f46" : "#b91c1c",
                  background: almacen.disponible ? "#ecfdf5" : "#fef2f2",
                  border: `1px solid ${
                    almacen.disponible ? "#a7f3d0" : "#fecaca"
                  }`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  marginBottom: 10,
                }}
              >
                <div>
                  {almacen.disponible ? "✓" : "⚠"} {almacen.mensaje}
                </div>
                <div style={{ marginTop: 4, color: "#6b7280" }}>
                  {almacen.origen}
                  {almacen.usoMB !== null &&
                    almacen.quotaMB !== null &&
                    ` · ${almacen.usoMB}/${almacen.quotaMB} MB`}
                  {almacen.disponible && !almacen.persistido && (
                    <button
                      onClick={handlePersistencia}
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        background: "#fff",
                        border: "1px solid #a7f3d0",
                        borderRadius: 6,
                        padding: "2px 8px",
                        cursor: "pointer",
                      }}
                    >
                      No borrar al cerrar
                    </button>
                  )}
                </div>
                <div style={{ marginTop: 4, color: "#6b7280" }}>
                  El historial vive en este navegador + esta URL. Si cambias de
                  perfil o de URL (localhost vs Vercel), verás lista vacía.
                </div>
              </div>
            )}
            {errorHistorial && (
              <div
                style={{
                  fontSize: 11,
                  color: "#b91c1c",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: "8px 10px",
                  marginBottom: 10,
                }}
              >
                ⚠ {errorHistorial}
              </div>
            )}
            {ultimaSesion && (
              <div
                style={{
                  fontSize: 12,
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: 8,
                  padding: "8px 10px",
                  marginBottom: 10,
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  Última sesión sin guardar: {ultimaSesion.alumno}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  {ultimaSesion.fechaISO.slice(0, 16).replace("T", " ")} ·{" "}
                  {ultimaSesion.numElementos} elementos (autosave 30s)
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button
                    onClick={handleRecuperarUltima}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: "#1d4ed8",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "4px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Recuperar
                  </button>
                  <button
                    onClick={handleDescartarUltima}
                    style={{
                      fontSize: 11,
                      background: "#fff",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      padding: "4px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <input
                value={alumno}
                onChange={(e) => setAlumno(e.target.value)}
                placeholder="Nombre del alumno"
                style={{
                  flex: 1,
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 12,
                }}
              />
              <button
                onClick={handleGuardar}
                style={{
                  background: "#1d4ed8",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Guardar
              </button>
            </div>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar alumno…"
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 12,
                marginBottom: 10,
                boxSizing: "border-box",
              }}
            />
            {pizarrasFiltradas.length === 0 && (
              <p style={{ fontSize: 12, color: "#6b7280" }}>
                Sin pizarras guardadas todavía.
              </p>
            )}
            {pizarrasFiltradas.map((p) => (
              <div
                key={p.key}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 8,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.alumno}</div>
                {resumenFicha(p) && (
                  <div
                    style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 600 }}
                  >
                    {resumenFicha(p)}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  {(p.fechaSesion || p.fechaISO).slice(0, 10)} ·{" "}
                  {p.numElementos} elementos
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button
                    onClick={async () => {
                      try {
                        await cargarPizarra(excalidrawAPI, p.key);
                        mostrarAviso("Pizarra cargada.");
                      } catch (e) {
                        mostrarAviso(errorAmigable(e));
                      }
                    }}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      border: "1px solid #bfdbfe",
                      borderRadius: 6,
                      padding: "4px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Abrir
                  </button>
                  <button
                    onClick={() =>
                      descargarPizarra(p, () => obtenerRegistro(p.key))
                    }
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: "#f9fafb",
                      color: "#374151",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      padding: "4px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Descargar
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`¿Borrar pizarra de ${p.alumno}?`)) {
                        try {
                          await borrarPizarra(p.key);
                          refrescarHistorial();
                        } catch (e) {
                          mostrarAviso(errorAmigable(e));
                        }
                      }
                    }}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: "#fef2f2",
                      color: "#b91c1c",
                      border: "1px solid #fecaca",
                      borderRadius: 6,
                      padding: "4px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            ))}
            <div
              style={{
                borderTop: "1px solid #e5e7eb",
                marginTop: 12,
                paddingTop: 10,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700 }}>
                Respaldo (para cambiar de navegador/PC)
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  onClick={handleExportarTodo}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: "#f9fafb",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    padding: "4px 8px",
                    cursor: "pointer",
                  }}
                >
                  Exportar todo
                </button>
                <button
                  onClick={() => importarTodoRef.current?.click()}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: "#f9fafb",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    padding: "4px 8px",
                    cursor: "pointer",
                  }}
                >
                  Importar respaldo
                </button>
                <button
                  onClick={() => importarEscenaRef.current?.click()}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: "#f9fafb",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    padding: "4px 8px",
                    cursor: "pointer",
                  }}
                >
                  Abrir .excalidraw
                </button>
              </div>
              <input
                ref={importarTodoRef}
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) {
                    return;
                  }
                  try {
                    const n = await importarRespaldoTodo(
                      await leerArchivo(file),
                    );
                    refrescarHistorial();
                    mostrarAviso(`Respaldo importado: ${n} pizarras.`);
                  } catch (err) {
                    mostrarAviso(errorAmigable(err));
                  }
                }}
              />
              <input
                ref={importarEscenaRef}
                type="file"
                accept="application/json,.excalidraw,.json"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) {
                    return;
                  }
                  try {
                    const datos = (await leerArchivo(file)) as {
                      elements?: unknown[];
                      files?: Record<string, unknown>;
                    };
                    if (
                      confirm(
                        "Esto reemplaza el canvas actual. ¿Abrir el archivo?",
                      )
                    ) {
                      const n = importarEscenaDesdeObjeto(excalidrawAPI, datos);
                      mostrarAviso(`Archivo abierto (${n} elementos).`);
                    }
                  } catch (err) {
                    mostrarAviso(errorAmigable(err));
                  }
                }}
              />
              <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>
                Tip: usa Descargar por pizarra o Exportar todo antes de limpiar
                el navegador.
              </p>
            </div>
          </div>
        )}
      </div>

      {aviso && (
        <div
          style={{
            padding: "8px 12px",
            background: "#03045e",
            color: "#fff",
            fontSize: 12,
            textAlign: "center",
          }}
        >
          {aviso}
        </div>
      )}
    </div>
  );
};
