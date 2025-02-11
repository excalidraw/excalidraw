import type { Complex } from "./types";

export function complex(real: number, imag?: number): Complex {
  return [real, imag ?? 0] as Complex;
}

export function add(a: Complex, b: Complex) {
  return complex(a[0] + b[0], a[1] + b[1]);
}

export function sub(a: Complex, b: Complex): Complex {
  return complex(a[0] - b[0], a[1] - b[1]);
}

export function mul(a: Complex, b: Complex) {
  return complex(a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]);
}

export function conjugate(a: Complex): Complex {
  return complex(a[0], -a[1]);
}

export function pow(a: Complex, b: Complex): Complex {
  const tIsZero = a[0] === 0 && a[1] === 0;
  const zIsZero = b[0] === 0 && b[1] === 0;

  if (zIsZero) {
    return complex(1);
  }

  // If the exponent is real
  if (b[1] === 0) {
    if (b[1] === 0 && a[0] > 0) {
      return complex(Math.pow(a[0], b[0]), 0);
    } else if (a[0] === 0) {
      // If base is fully imaginary

      switch (((b[0] % 4) + 4) % 4) {
        case 0:
          return complex(Math.pow(a[1], b[0]), 0);
        case 1:
          return complex(0, Math.pow(a[1], b[0]));
        case 2:
          return complex(-Math.pow(a[1], b[0]), 0);
        case 3:
          return complex(0, -Math.pow(b[1], a[0]));
      }
    }
  }

  if (tIsZero && b[0] > 0) {
    // Same behavior as Wolframalpha, Zero if real part is zero
    return complex(0);
  }

  const arg = Math.atan2(a[1], a[0]);
  const loh = logHypot(a[0], a[1]);

  const re = Math.exp(b[0] * loh - b[1] * arg);
  const im = b[1] * loh + b[0] * arg;

  return complex(re * Math.cos(im), re * Math.sin(im));
}

export function sqrt([a, b]: Complex): Complex {
  if (b === 0) {
    // Real number case
    if (a >= 0) {
      return complex(Math.sqrt(a), 0);
    }

    return complex(0, Math.sqrt(-a));
  }

  const r = hypot(a, b);

  const re = Math.sqrt(0.5 * (r + Math.abs(a))); // sqrt(2x) / 2 = sqrt(x / 2)
  const im = Math.abs(b) / (2 * re);

  if (a >= 0) {
    return complex(re, b < 0 ? -im : im);
  }

  return complex(im, b < 0 ? -re : re);
}

const hypot = function (x: number, y: number) {
  x = Math.abs(x);
  y = Math.abs(y);

  // Ensure `x` is the larger value
  if (x < y) {
    [x, y] = [y, x];
  }

  // If both are below the threshold, use straightforward Pythagoras
  if (x < 1e8) {
    return Math.sqrt(x * x + y * y);
  }

  // For larger values, scale to avoid overflow
  y /= x;
  return x * Math.sqrt(1 + y * y);
};

/**
 * Calculates log(sqrt(a^2+b^2)) in a way to avoid overflows
 *
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function logHypot(a: number, b: number) {
  const _a = Math.abs(a);
  const _b = Math.abs(b);

  if (a === 0) {
    return Math.log(_b);
  }

  if (b === 0) {
    return Math.log(_a);
  }

  if (_a < 3000 && _b < 3000) {
    return Math.log(a * a + b * b) * 0.5;
  }

  a = a * 0.5;
  b = b * 0.5;

  return 0.5 * Math.log(a * a + b * b) + Math.LN2;
}
