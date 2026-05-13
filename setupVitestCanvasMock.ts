import { vi } from "vitest";

// `vitest-canvas-mock` expects Jest globals while the module initializes.
(globalThis as unknown as { jest: typeof vi }).jest = vi;
