// Asistente IA vía OpenRouter (BYOK: la key vive solo en tu navegador).
// Sin servidor propio: el fetch va directo del browser a OpenRouter.

export const MODELO_DEFAULT = "deepseek/deepseek-chat";

const CLAVE_KEY = "clases:openrouter-key";
const MODELO_KEY = "clases:openrouter-modelo";

export function leerClave(): string {
  try {
    return localStorage.getItem(CLAVE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function guardarClave(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(CLAVE_KEY, key.trim());
    } else {
      localStorage.removeItem(CLAVE_KEY);
    }
  } catch {
    // best-effort
  }
}

export function leerModelo(): string {
  try {
    return localStorage.getItem(MODELO_KEY) || MODELO_DEFAULT;
  } catch {
    return MODELO_DEFAULT;
  }
}

export function guardarModelo(modelo: string): void {
  try {
    localStorage.setItem(MODELO_KEY, modelo.trim() || MODELO_DEFAULT);
  } catch {
    // best-effort
  }
}

export interface PeticionEjercicios {
  grado: string;
  tema: string;
  cantidad: number;
  dificultad: "fácil" | "media" | "difícil";
  conSolucionario: boolean;
}

export interface ResultadoEjercicios {
  ejercicios: string[];
  soluciones: string[];
  textoCrudo: string;
}

const SISTEMA = `Eres docente de matemáticas de grados 7-12 (Puerto Rico / Common Core).
Devuelves ejercicios en español, claros y listos para resolver en pizarra.
REGLA DE ORO: escribe matemática en TEXTO PLANO legible, NUNCA código LaTeX.
Prohibido: \\( \\), \\[, \\], $, \\frac, \\sqrt, \\times, \\div, \\leq, \\geq, \\neq, \\cdot, \\left, \\right, ^ con llaves, _ con llaves y cualquier comando con barra invertida.
Usa en su lugar: √() para raíces, (a)/(b) para fracciones, ² ³ ½ ¼ ¾ para potencias y fracciones comunes, × ÷ ≤ ≥ ≠ ± ∞ π θ α β Δ ≈ → ∈ ⁿ ₙ, x², x³, xₙ.
Ejemplos correctos: "f(x) = √(4 - x²) - 1", "g(x) = (2x)/(x + 1)", "h(x) = x² + 4x - 1".
Formato estricto:
1. <ejercicio>
2. <ejercicio>
...
Si se pide solucionario, al final agrega un bloque exactamente así:
SOLUCIONES:
1. <respuesta breve con procedimiento en 1 línea>
2. <respuesta breve>
Sin introducciones ni despedidas.`;

export async function generarEjercicios(
  peticion: PeticionEjercicios,
  apiKey: string,
  modelo: string,
): Promise<ResultadoEjercicios> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error("Pega tu API key de OpenRouter primero.");
  }
  if (!peticion.tema.trim()) {
    throw new Error("Escribe el tema (ej. ecuaciones lineales).");
  }
  const user = [
    `Grado ${peticion.grado}. Tema: ${peticion.tema.trim()}.`,
    `Cantidad: ${peticion.cantidad}. Dificultad: ${peticion.dificultad}.`,
    peticion.conSolucionario
      ? "Incluye el bloque SOLUCIONES: al final."
      : "Sin solucionario, solo los ejercicios numerados.",
  ].join(" ");

  let resp: Response;
  try {
    resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          typeof window !== "undefined" ? window.location.origin : "",
        "X-Title": "excalidraw-clases",
      },
      body: JSON.stringify({
        model: modelo.trim() || MODELO_DEFAULT,
        messages: [
          { role: "system", content: SISTEMA },
          { role: "user", content: user },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });
  } catch {
    throw new Error("Sin conexión a OpenRouter. Revisa tu internet.");
  }

  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      throw new Error("Key inválida o sin permiso (revisa OpenRouter).");
    }
    if (resp.status === 429) {
      throw new Error(
        "Límite de OpenRouter alcanzado. Espera e intenta de nuevo.",
      );
    }
    let detalle = "";
    try {
      const data = (await resp.json()) as {
        error?: { message?: string };
        message?: string;
      };
      detalle = data?.error?.message || data?.message || "";
    } catch {
      // ignorar
    }
    throw new Error(
      detalle
        ? `OpenRouter error ${resp.status}: ${detalle}`
        : `OpenRouter error ${resp.status}.`,
    );
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const texto = data?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!texto) {
    throw new Error("Respuesta vacía del modelo. Intenta de nuevo.");
  }
  return { ...parsearRespuesta(texto), textoCrudo: texto };
}

const SUP: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
  "+": "⁺",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
  n: "ⁿ",
  x: "ˣ",
  i: "ⁱ",
  a: "ᵃ",
  b: "ᵇ",
  c: "ᶜ",
  d: "ᵈ",
  e: "ᵉ",
  f: "ᶠ",
  g: "ᵍ",
  h: "ʰ",
  j: "ʲ",
  k: "ᵏ",
  l: "ˡ",
  m: "ᵐ",
  o: "ᵒ",
  p: "ᵖ",
  r: "ʳ",
  s: "ˢ",
  t: "ᵗ",
  u: "ᵘ",
  v: "ᵛ",
  w: "ʷ",
  y: "ʸ",
  z: "ᶻ",
};

const SUB: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  "=": "₌",
  "(": "₍",
  ")": "₎",
  a: "ₐ",
  e: "ₑ",
  o: "ₒ",
  x: "ₓ",
  h: "ₕ",
  k: "ₖ",
  l: "ₗ",
  m: "ₘ",
  n: "ₙ",
  p: "ₚ",
  s: "ₛ",
  t: "ₜ",
};

function aSup(s: string): string {
  return [...s].map((c) => SUP[c] ?? c).join("");
}

function aSub(s: string): string {
  return [...s].map((c) => SUB[c] ?? c).join("");
}

/**
 * Convierte restos de LaTeX a texto plano legible en pizarra:
 * \frac{a}{b} → (a)/(b), \sqrt{x} → √(x), ^{2} → ², \( \) $ → nada,
 * \times → ×, etc. Red de seguridad por si el modelo ignora el prompt.
 */
export function normalizarTexto(t: string): string {
  let s = t;
  s = s.replace(/\\\\/g, " "); // salto de línea LaTeX → espacio
  s = s.replace(/\\\(|\\\)|\\\[|\\\]/g, "");
  s = s.replace(/\\begin\{[^{}]*\}|\\end\{[^{}]*\}/g, "");
  s = s.replace(/\\text\{([^{}]*)\}/g, "$1");
  s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)");
  s = s.replace(/\\sqrt(?:\[([^\]]*)\])?\{([^{}]*)\}/g, (_, n, x) =>
    n ? `${aSup(n)}√(${x})` : `√(${x})`,
  );
  s = s.replace(/\\left\s*([({|])|\\right\s*([)}|])/g, "$1$2");
  s = s.replace(/\\left|\\right/g, "");
  s = s.replace(/\\ /g, " ");
  s = s.replace(/\^\{([^{}]*)\}/g, (_, x) => aSup(x));
  s = s.replace(/\^([0-9a-zA-Z])/g, (_, x) => SUP[x] ?? `^${x}`);
  s = s.replace(/_\{([^{}]*)\}/g, (_, x) => aSub(x));
  s = s.replace(/_([0-9a-zA-Z])/g, (_, x) => SUB[x] ?? `_${x}`);
  const simbolos: Array<[RegExp, string]> = [
    [/\\times|\\cdot/g, "×"],
    [/\\div/g, "÷"],
    [/\\pm/g, "±"],
    [/\\leq|\\le\b/g, "≤"],
    [/\\geq|\\ge\b/g, "≥"],
    [/\\neq|\\ne\b/g, "≠"],
    [/\\approx/g, "≈"],
    [/\\infty/g, "∞"],
    [/\\rightarrow|\\to\b/g, "→"],
    [/\\in\b/g, "∈"],
    [/\\pi/g, "π"],
    [/\\theta/g, "θ"],
    [/\\alpha/g, "α"],
    [/\\beta/g, "β"],
    [/\\Delta/g, "Δ"],
    [/\\[—–-]/g, "-"],
  ];
  for (const [re, rep] of simbolos) {
    s = s.replace(re, rep);
  }
  s = s.replace(/\\([a-zA-Z]+)/g, "$1"); // \sin → sin, \ln → ln
  s = s.replace(/[{}]/g, "");
  s = s.replace(/\$/g, "");
  s = s.replace(/\*\*(.+?)\*\*/g, "$1"); // **negrita** markdown → plano
  s = s.replace(/&/g, "");
  s = s.replace(/[ \t]{2,}/g, " ");
  s = s.replace(/\s+([.,;:!?])/g, "$1");
  return s.trim();
}

/** Separa ejercicios numerados y bloque SOLUCIONES: (tolerante al formato). */
export function parsearRespuesta(texto: string): {
  ejercicios: string[];
  soluciones: string[];
} {
  const lineas = texto.split("\n").map((l) => l.trim());
  const idxSol = lineas.findIndex((l) => /^soluciones\s*:?$/i.test(l));
  const bloqueEj = idxSol === -1 ? lineas : lineas.slice(0, idxSol);
  const bloqueSol = idxSol === -1 ? [] : lineas.slice(idxSol + 1);
  const num = /^\d+\s*[.)\-:]\s*(.+)$/;
  const ejercicios = bloqueEj
    .map((l) => l.match(num)?.[1]?.trim() ?? "")
    .filter(Boolean)
    .map(normalizarTexto)
    .filter(Boolean);
  const soluciones = bloqueSol
    .map((l) => l.match(num)?.[1]?.trim() ?? "")
    .filter(Boolean)
    .map(normalizarTexto)
    .filter(Boolean);
  // fallback: si el modelo no numeró, usa líneas no vacías como ejercicios
  if (ejercicios.length === 0) {
    const fallback = bloqueEj
      .filter((l) => l.length > 0 && !/^soluciones/i.test(l))
      .map(normalizarTexto)
      .filter(Boolean);
    return { ejercicios: fallback, soluciones };
  }
  return { ejercicios, soluciones };
}
