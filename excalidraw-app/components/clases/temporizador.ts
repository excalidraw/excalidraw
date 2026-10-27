// Temporizador de clase: fases Objetivo/Ejemplo/Práctica + tiempo libre.
// La cuenta regresiva vive en PanelClases; aquí solo fases y formato.

export interface Fase {
  id: string;
  nombre: string;
  minutos: number;
}

export const FASES: Fase[] = [
  { id: "objetivo", nombre: "Objetivo", minutos: 5 },
  { id: "ejemplo", nombre: "Ejemplo", minutos: 15 },
  { id: "practica", nombre: "Práctica", minutos: 10 },
];

export function formatear(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** Pitido corto al terminar (WebAudio, sin archivos). Best-effort. */
export function beep(): void {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) {
      return;
    }
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    window.setTimeout(() => void ctx.close(), 600);
  } catch {
    // best-effort
  }
}
