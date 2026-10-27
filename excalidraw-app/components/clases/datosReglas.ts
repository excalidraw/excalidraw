// Banco de reglas matemáticas 7-12 (Common Core USA).
// Fuente: "Hoja de Reglas Matemáticas 7-12 • Consulta rápida" del docente.
export interface ReglaTema {
  titulo: string;
  reglas: string[];
}

export interface ReglaGrado {
  grado: string;
  nombre: string;
  color: string;
  temas: ReglaTema[];
}

export const REGLAS: ReglaGrado[] = [
  {
    grado: "7",
    nombre: "Racionales y proporciones",
    color: "#1d4ed8",
    temas: [
      {
        titulo: "Fracciones",
        reglas: [
          "Suma y resta con común denominador",
          "Multiplicar directo",
          "Dividir es multiplicar por el recíproco",
          "Simplifica siempre. Ej: 2/3 + 1/6 = 5/6, 2/3 ÷ 4/5 = 5/6",
        ],
      },
      {
        titulo: "Mixtos y decimales",
        reglas: [
          "Mixto a impropia: 2½ = 5/2",
          "Suma y resta alineando el punto",
          "Multiplicar contando decimales",
          "0.25 = 1/4, 0.5 = 1/2, 0.75 = 3/4",
        ],
      },
      {
        titulo: "Signos y valor absoluto",
        reglas: [
          "(−) × (−) = +  |  (−) × (+) = −",
          "−3 − 5 = −8",
          "|x| es distancia al 0. Ej: |−7| = 7",
        ],
      },
      {
        titulo: "Porcentajes y proporción",
        reglas: [
          "parte = % × total  |  % = parte ÷ total × 100",
          "Regla de tres: si a/b = c/d entonces a × d = b × c",
          "Ej: 20% de 80 = 16",
        ],
      },
      {
        titulo: "Ecuaciones y geometría",
        reglas: [
          "Haz lo inverso en ambos lados",
          "Si multiplicas o divides por negativo en desigualdad, cambia el signo",
          "3 × (x + 4) = 3x + 12",
          "Círculo: C = 2 × π × r,  A = π × r²",
        ],
      },
    ],
  },
  {
    grado: "8",
    nombre: "Exponentes y función lineal",
    color: "#0e7490",
    temas: [
      {
        titulo: "Exponentes",
        reglas: [
          "aᵐ × aⁿ = aᵐ⁺ⁿ  |  aᵐ ÷ aⁿ = aᵐ⁻ⁿ",
          "(aᵐ)ⁿ = aᵐˣⁿ  |  (a × b)ⁿ = aⁿ × bⁿ",
          "a⁰ = 1  |  a⁻ⁿ = 1 ÷ aⁿ",
        ],
      },
      {
        titulo: "Notación científica",
        reglas: [
          "N = C × 10ⁿ con 1 ≤ C < 10",
          "(a × 10ᵐ) × (b × 10ⁿ) = (a × b) × 10ᵐ⁺ⁿ",
          "División: (a ÷ b) × 10ᵐ⁻ⁿ",
        ],
      },
      {
        titulo: "Radicales",
        reglas: [
          "√(a × b) = √a × √b  |  √(a ÷ b) = √a ÷ √b",
          "√49 = 7,  ∛27 = 3",
          "Solo se suman con mismo índice y mismo radicando",
        ],
      },
      {
        titulo: "Función lineal",
        reglas: [
          "Pendiente m = (y₂ − y₁) ÷ (x₂ − x₁)",
          "y = m × x + b,  b es el corte con y",
          "Paralelas: mismo m  |  Perpendicular: m → −1 ÷ m",
          "Función: cada x tiene un solo y",
        ],
      },
      {
        titulo: "Pitágoras y volumen",
        reglas: [
          "a² + b² = c², solo triángulo rectángulo",
          "d = √[(x₂ − x₁)² + (y₂ − y₁)²]",
          "Cilindro V = π × r² × h",
          "Cono V = (1 ÷ 3) × π × r² × h",
          "Esfera V = (4 ÷ 3) × π × r³",
        ],
      },
    ],
  },
  {
    grado: "9",
    nombre: "Álgebra 1",
    color: "#15803d",
    temas: [
      {
        titulo: "Polinomios",
        reglas: [
          "(x + a) × (x + b) = x² + (a + b) × x + a × b",
          "(a + b)² = a² + 2ab + b²",
          "(a − b) × (a + b) = a² − b²",
        ],
      },
      {
        titulo: "Factorización",
        reglas: [
          "1) Saca factor común primero",
          "2) x² + bx + c: busca dos que multipliquen c y sumen b",
          "3) 4x² − 25 = (2x − 5) × (2x + 5)",
        ],
      },
      {
        titulo: "Ecuaciones y sistemas",
        reglas: [
          "|x − 3| = 5  →  x = 8 o x = −2",
          "Sistema 2×2 por sustitución, eliminación o gráfica",
          "Casos: 1 solución, ninguna, infinitas",
        ],
      },
      {
        titulo: "Cuadráticas",
        reglas: [
          "Iguala a 0 y factoriza",
          "x = (−b ± √(b² − 4ac)) ÷ (2a)",
          "D = b² − 4ac: D > 0 dos soluciones, D = 0 una, D < 0 ninguna real",
          "Vértice en x = −b ÷ (2a)",
        ],
      },
      {
        titulo: "Funciones y racionales",
        reglas: [
          "f(x) se evalúa sustituyendo",
          "Lineal: diferencia constante; Exponencial y = a × bˣ: razón constante",
          "(x² − 9) ÷ (x + 3) = x − 3",
        ],
      },
    ],
  },
  {
    grado: "10",
    nombre: "Geometría",
    color: "#7e22ce",
    temas: [
      {
        titulo: "Congruencia",
        reglas: [
          "Casos: LLL, LAL, ALA, AAL, HL",
          "Si son congruentes, todas sus partes son iguales",
        ],
      },
      {
        titulo: "Semejanza",
        reglas: [
          "Casos: AA, LLL~, LAL~  |  Lados proporcionales",
          "Escala k: perímetro × k, área × k², volumen × k³",
        ],
      },
      {
        titulo: "Triángulos y paralelas",
        reglas: [
          "Suma de ángulos = 180°",
          "Exterior = suma de los dos no adyacentes",
          "Alternos internos iguales",
          "sen = op ÷ hip,  cos = ady ÷ hip,  tan = op ÷ ady",
        ],
      },
      {
        titulo: "Círculos",
        reglas: [
          "Radio ⊥ tangente",
          "Ángulo central = arco  |  Ángulo inscrito = mitad del arco",
          "Arco L = (θ ÷ 360) × 2 × π × r",
          "Sector A = (θ ÷ 360) × π × r²",
        ],
      },
      {
        titulo: "Coordenadas y movimientos",
        reglas: [
          "Punto medio = ((x₁ + x₂) ÷ 2, (y₁ + y₂) ÷ 2)",
          "Círculo: (x − h)² + (y − k)² = r²",
          "Traslación, reflexión, rotación, dilatación",
          "Trapecio A = (B + b) × h ÷ 2",
        ],
      },
    ],
  },
  {
    grado: "11",
    nombre: "Álgebra 2",
    color: "#c2410c",
    temas: [
      {
        titulo: "Logaritmos",
        reglas: [
          "log(a × b) = log a + log b",
          "log(a ÷ b) = log a − log b",
          "log(aⁿ) = n × log a",
          "Cambio de base: logₐ b = ln b ÷ ln a",
          "logₐ a = 1,  logₐ 1 = 0",
        ],
      },
      {
        titulo: "Exponencial y complejos",
        reglas: [
          "Son inversas: 2ˣ = 16 → x = 4",
          "e ≈ 2.718,  ln(eˣ) = x",
          "i² = −1",
          "(a + bi) × (a − bi) = a² + b²",
          "|a + bi| = √(a² + b²)",
        ],
      },
      {
        titulo: "Polinomios avanzados",
        reglas: [
          "División sintética, teorema del residuo y del factor",
          "Raíces racionales p ÷ q",
          "Asíntota vertical: donde se anula el denominador",
        ],
      },
      {
        titulo: "Sucesiones y series",
        reglas: [
          "Aritmética: aₙ = a₁ + (n − 1) × d",
          "Geométrica: aₙ = a₁ × rⁿ⁻¹",
          "Suma geométrica: Sₙ = a₁ × (1 − rⁿ) ÷ (1 − r)",
        ],
      },
      {
        titulo: "Conteo y probabilidad",
        reglas: [
          "Permutación P = n! ÷ (n − r)!",
          "Combinación C = n! ÷ [r! × (n − r)!]",
          "P(A|B) = P(A ∩ B) ÷ P(B)",
        ],
      },
    ],
  },
  {
    grado: "12",
    nombre: "Precálculo y estadística",
    color: "#881337",
    temas: [
      {
        titulo: "Círculo unitario",
        reglas: [
          "π radianes = 180°",
          "sen 30° = 1 ÷ 2,  cos 45° = √2 ÷ 2",
          "sen² θ + cos² θ = 1  |  Período 2π",
        ],
      },
      {
        titulo: "Identidades y leyes",
        reglas: [
          "sen 2θ = 2 × sen θ × cos θ",
          "Ley de senos: a ÷ sen A = b ÷ sen B",
          "Ley de cosenos: c² = a² + b² − 2 × a × b × cos C",
        ],
      },
      {
        titulo: "Funciones y cónicas",
        reglas: [
          "Composición (f ∘ g)(x) = f(g(x))",
          "Inversa: intercambia x con y",
          "Desplaza y estira: f(x) + k,  k × f(x),  f(x + k)",
          "Elipse: x² ÷ a² + y² ÷ b² = 1",
        ],
      },
      {
        titulo: "Vectores y matrices",
        reglas: [
          "|v| = √(x² + y²)",
          "a · b = |a| × |b| × cos θ",
          "Multiplica fila × columna",
          "Determinante 2×2: det = a × d − b × c",
        ],
      },
      {
        titulo: "Límites y estadística",
        reglas: [
          "Factoriza y simplifica antes de sustituir",
          "Normal 68 − 95 − 99.7",
          "z = (x − μ) ÷ σ",
          "Recta y = m × x + b, correlación r entre −1 y 1",
        ],
      },
    ],
  },
];
