export type MathSymbol = {
  symbol: string;
  /** space-separated search keywords (the first one is shown as the title) */
  keywords: string;
};

export type MathSymbolCategory = {
  id:
    | "greekLower"
    | "greekUpper"
    | "operators"
    | "relations"
    | "calculus"
    | "setsAndLogic"
    | "arrows"
    | "scripts"
    | "misc";
  symbols: readonly MathSymbol[];
};

const s = (symbol: string, keywords: string): MathSymbol => ({
  symbol,
  keywords,
});

export const MATH_SYMBOL_CATEGORIES: readonly MathSymbolCategory[] = [
  {
    id: "greekLower",
    symbols: [
      s("α", "alpha"),
      s("β", "beta"),
      s("γ", "gamma"),
      s("δ", "delta"),
      s("ε", "epsilon"),
      s("ζ", "zeta"),
      s("η", "eta"),
      s("θ", "theta"),
      s("ι", "iota"),
      s("κ", "kappa"),
      s("λ", "lambda"),
      s("μ", "mu micro"),
      s("ν", "nu"),
      s("ξ", "xi"),
      s("ο", "omicron"),
      s("π", "pi"),
      s("ρ", "rho"),
      s("σ", "sigma"),
      s("τ", "tau"),
      s("υ", "upsilon"),
      s("φ", "phi"),
      s("χ", "chi"),
      s("ψ", "psi"),
      s("ω", "omega"),
    ],
  },
  {
    id: "greekUpper",
    symbols: [
      s("Γ", "Gamma"),
      s("Δ", "Delta"),
      s("Θ", "Theta"),
      s("Λ", "Lambda"),
      s("Ξ", "Xi"),
      s("Π", "Pi product"),
      s("Σ", "Sigma"),
      s("Υ", "Upsilon"),
      s("Φ", "Phi"),
      s("Ψ", "Psi"),
      s("Ω", "Omega ohm"),
    ],
  },
  {
    id: "operators",
    symbols: [
      s("+", "plus"),
      s("−", "minus"),
      s("±", "plus-minus"),
      s("∓", "minus-plus"),
      s("×", "times multiply cross"),
      s("÷", "divide division"),
      s("·", "dot multiply"),
      s("∘", "compose ring"),
      s("√", "square root sqrt radical"),
      s("∛", "cube root"),
      s("∜", "fourth root"),
      s("∣", "divides"),
      s("⊗", "tensor product otimes"),
      s("⊕", "direct sum oplus xor"),
      s("%", "percent"),
      s("‰", "per mille"),
    ],
  },
  {
    id: "relations",
    symbols: [
      s("=", "equals"),
      s("≠", "not equal"),
      s("≈", "approximately almost equal"),
      s("≡", "identical congruent equivalent"),
      s("≅", "congruent isomorphic"),
      s("∼", "similar tilde"),
      s("∝", "proportional"),
      s("<", "less than"),
      s(">", "greater than"),
      s("≤", "less than or equal"),
      s("≥", "greater than or equal"),
      s("≪", "much less than"),
      s("≫", "much greater than"),
      s("≔", "defined as colon equals"),
      s("≜", "defined as delta equals"),
    ],
  },
  {
    id: "calculus",
    symbols: [
      s("∑", "summation sum sigma"),
      s("∏", "product pi"),
      s("∫", "integral"),
      s("∬", "double integral"),
      s("∭", "triple integral"),
      s("∮", "contour integral"),
      s("∂", "partial derivative"),
      s("∇", "nabla gradient del"),
      s("∆", "increment laplacian delta"),
      s("∞", "infinity"),
      s("′", "prime derivative"),
      s("″", "double prime"),
    ],
  },
  {
    id: "setsAndLogic",
    symbols: [
      s("∈", "element of in"),
      s("∉", "not element of not in"),
      s("∋", "contains as member"),
      s("⊂", "subset"),
      s("⊃", "superset"),
      s("⊆", "subset or equal"),
      s("⊇", "superset or equal"),
      s("⊄", "not subset"),
      s("∪", "union"),
      s("∩", "intersection"),
      s("∖", "set minus difference"),
      s("∅", "empty set"),
      s("ℕ", "natural numbers"),
      s("ℤ", "integers"),
      s("ℚ", "rational numbers"),
      s("ℝ", "real numbers"),
      s("ℂ", "complex numbers"),
      s("∀", "for all"),
      s("∃", "exists"),
      s("∄", "does not exist"),
      s("¬", "not negation"),
      s("∧", "and conjunction wedge"),
      s("∨", "or disjunction vee"),
      s("⊤", "true top"),
      s("⊥", "false bottom perpendicular"),
      s("⊢", "proves turnstile"),
      s("⊨", "models entails"),
      s("∴", "therefore"),
      s("∵", "because since"),
    ],
  },
  {
    id: "arrows",
    symbols: [
      s("→", "right arrow to maps tends limit"),
      s("←", "left arrow"),
      s("↔", "left right arrow"),
      s("↑", "up arrow"),
      s("↓", "down arrow"),
      s("↦", "maps to"),
      s("⇒", "implies double right arrow"),
      s("⇐", "implied by double left arrow"),
      s("⇔", "if and only if iff equivalent"),
      s("⟶", "long right arrow"),
      s("↗", "north east arrow increasing"),
      s("↘", "south east arrow decreasing"),
      s("⇌", "equilibrium"),
    ],
  },
  {
    id: "scripts",
    symbols: [
      s("⁰", "superscript 0"),
      s("¹", "superscript 1"),
      s("²", "superscript 2 squared"),
      s("³", "superscript 3 cubed"),
      s("⁴", "superscript 4"),
      s("⁵", "superscript 5"),
      s("⁶", "superscript 6"),
      s("⁷", "superscript 7"),
      s("⁸", "superscript 8"),
      s("⁹", "superscript 9"),
      s("⁺", "superscript plus"),
      s("⁻", "superscript minus inverse"),
      s("ⁿ", "superscript n"),
      s("ⁱ", "superscript i"),
      s("₀", "subscript 0"),
      s("₁", "subscript 1"),
      s("₂", "subscript 2"),
      s("₃", "subscript 3"),
      s("₄", "subscript 4"),
      s("₅", "subscript 5"),
      s("₆", "subscript 6"),
      s("₇", "subscript 7"),
      s("₈", "subscript 8"),
      s("₉", "subscript 9"),
      s("ₙ", "subscript n"),
      s("ᵢ", "subscript i"),
      s("½", "one half fraction"),
      s("⅓", "one third fraction"),
      s("¼", "one quarter fraction"),
      s("¾", "three quarters fraction"),
    ],
  },
  {
    id: "misc",
    symbols: [
      s("°", "degree"),
      s("∠", "angle"),
      s("∥", "parallel"),
      s("△", "triangle"),
      s("ℏ", "h-bar planck"),
      s("ℓ", "script l ell"),
      s("ℵ", "aleph"),
      s("⌊", "left floor"),
      s("⌋", "right floor"),
      s("⌈", "left ceiling"),
      s("⌉", "right ceiling"),
      s("⟨", "left angle bracket"),
      s("⟩", "right angle bracket"),
      s("‖", "norm double bar"),
      s("…", "ellipsis dots"),
      s("⋯", "center ellipsis cdots"),
    ],
  },
];

/** filters the categories to the symbols matching the query, dropping the
 *  categories left empty */
export const filterMathSymbols = (
  query: string,
): readonly MathSymbolCategory[] => {
  const trimmed = query.trim();
  if (!trimmed) {
    return MATH_SYMBOL_CATEGORIES;
  }
  const needle = trimmed.toLowerCase();
  return MATH_SYMBOL_CATEGORIES.map((category) => ({
    ...category,
    symbols: category.symbols.filter(
      ({ symbol, keywords }) =>
        symbol === trimmed || keywords.toLowerCase().includes(needle),
    ),
  })).filter((category) => category.symbols.length > 0);
};
