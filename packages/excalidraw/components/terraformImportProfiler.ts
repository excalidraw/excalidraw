/**
 * Hierarchical profiler for Terraform import / layout (dev + vitest).
 * Enable: VITEST_TERRAFORM_PROFILE=1, localStorage.terraformImportProfile=1, or DEV.
 */

export type TerraformImportProfilerSpan = {
  name: string;
  ms: number;
  selfMs: number;
  callCount: number;
};

type StackEntry = { name: string; start: number };

let enabled: boolean | null = null;
const stack: StackEntry[] = [];
const totals = new Map<string, { ms: number; selfMs: number; callCount: number }>();

function isProfilerEnabled(): boolean {
  if (enabled !== null) {
    return enabled;
  }
  if (typeof process !== "undefined" && process.env.VITEST_TERRAFORM_PROFILE === "1") {
    return true;
  }
  if (import.meta.env.DEV && import.meta.env.VITE_TERRAFORM_IMPORT_PROFILE === "1") {
    return true;
  }
  if (
    typeof localStorage !== "undefined" &&
    localStorage.getItem("terraformImportProfile") === "1"
  ) {
    return true;
  }
  return false;
}

/** Tests / tooling: force profiler on or off (null = auto). */
export function setTerraformImportProfilerEnabled(value: boolean | null): void {
  enabled = value;
}

export function isTerraformImportProfilerEnabled(): boolean {
  return isProfilerEnabled();
}

function recordSpan(name: string, durationMs: number, selfMs: number): void {
  const prev = totals.get(name);
  if (prev) {
    prev.ms += durationMs;
    prev.selfMs += selfMs;
    prev.callCount += 1;
  } else {
    totals.set(name, { ms: durationMs, selfMs, callCount: 1 });
  }
}

export function terraformImportProfilerMark(_name: string): void {
  // Reserved for future instant events; spans use measure/measureAsync.
}

export function terraformImportProfilerMeasure<T>(name: string, fn: () => T): T {
  if (!isProfilerEnabled()) {
    return fn();
  }
  const parentSelf = stack.length > 0 ? stack[stack.length - 1]!.name : null;
  const start = performance.now();
  stack.push({ name, start });
  try {
    return fn();
  } finally {
    stack.pop();
    const durationMs = performance.now() - start;
    recordSpan(name, durationMs, durationMs);
    if (parentSelf) {
      const p = totals.get(parentSelf);
      if (p) {
        p.selfMs -= durationMs;
      }
    }
  }
}

export async function terraformImportProfilerMeasureAsync<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isProfilerEnabled()) {
    return fn();
  }
  const parentSelf = stack.length > 0 ? stack[stack.length - 1]!.name : null;
  const start = performance.now();
  stack.push({ name, start });
  try {
    return await fn();
  } finally {
    stack.pop();
    const durationMs = performance.now() - start;
    recordSpan(name, durationMs, durationMs);
    if (parentSelf) {
      const p = totals.get(parentSelf);
      if (p) {
        p.selfMs -= durationMs;
      }
    }
  }
}

export function terraformImportProfilerSummary(): TerraformImportProfilerSpan[] {
  return [...totals.entries()]
    .map(([name, v]) => ({
      name,
      ms: Math.round(v.ms * 100) / 100,
      selfMs: Math.round(Math.max(0, v.selfMs) * 100) / 100,
      callCount: v.callCount,
    }))
    .sort((a, b) => b.selfMs - a.selfMs);
}

export function terraformImportProfilerReset(): void {
  stack.length = 0;
  totals.clear();
}

export function terraformImportProfilerLogSummary(prefix = "[terraform:profile]"): void {
  if (!isProfilerEnabled()) {
    return;
  }
  const rows = terraformImportProfilerSummary();
  if (rows.length === 0) {
    return;
  }
  // eslint-disable-next-line no-console -- intentional profiling output
  console.log(prefix, rows);
}
