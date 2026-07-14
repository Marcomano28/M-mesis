// Moduladores — la respiración del taller.
// Un LFO escribe desplazamientos en el plano de modulación del ParamBus.
// Los salones no se enteran: siguen leyendo parámetros. En el Acto II, la
// guitarra será otra fuente escribiendo exactamente en este mismo plano.

import type { ParamBus } from './ParamBus';

export type FormaLFO = 'seno' | 'triangulo' | 'sierra' | 'cuadrada' | 'ruido';

export interface LFO {
  id: string;
  destino: string;      // dirección del bus, p.ej. "supershapes.n2"
  forma: FormaLFO;
  frecuencia: number;   // Hz
  amplitud: number;     // en unidades del parámetro (±)
  fase: number;         // 0..1
  /** Solo para forma 'ruido': exponente de Hurst H (IQ, fBM).
   *  1 = suave con memoria (montaña, "yellow noise") · 0 = nervioso (lluvia, pink). */
  rugosidad: number;
  activo: boolean;
}

export class MotorLFO {
  lfos: LFO[] = [];
  private destinoPrevio = new Map<string, string>();
  private secuencia = 1;

  constructor(private bus: ParamBus) {}

  crear(destino: string, amplitud: number): LFO {
    const lfo: LFO = {
      id: `lfo-${this.secuencia++}`,
      destino,
      forma: 'seno',
      frecuencia: 0.5,
      amplitud,
      fase: 0,
      rugosidad: 1,
      activo: true,
    };
    this.lfos.push(lfo);
    return lfo;
  }

  quitar(id: string): void {
    this.lfos = this.lfos.filter((l) => l.id !== id);
    this.bus.limpiarFuente(id);
    this.destinoPrevio.delete(id);
  }

  /** Un tick por frame: escribe los desplazamientos de todos los LFOs. */
  tick(tiempo: number): void {
    for (const l of this.lfos) {
      // Si el destino cambió, retirar la modulación que quedó en el anterior
      const previo = this.destinoPrevio.get(l.id);
      if (previo && previo !== l.destino) this.bus.quitarModulacion(previo, l.id);
      this.destinoPrevio.set(l.id, l.destino);

      const v = l.activo ? onda(l.forma, tiempo * l.frecuencia + l.fase, l.rugosidad) * l.amplitud : 0;
      this.bus.modular(l.destino, l.id, v);
    }
  }
}

/** Formas de onda normalizadas a [-1, 1]. `x` en ciclos (1.0 = un periodo).
 *  `H` (solo 'ruido'): exponente de Hurst del fBM — 1 suave, 0 nervioso. */
export function onda(forma: FormaLFO, x: number, H = 1): number {
  const p = x - Math.floor(x);
  switch (forma) {
    case 'seno':      return Math.sin(2 * Math.PI * x);
    case 'triangulo': return 1 - 4 * Math.abs(p - 0.5);
    case 'sierra':    return 2 * p - 1;
    case 'cuadrada':  return p < 0.5 ? 1 : -1;
    case 'ruido':     return fbm(x, Math.max(0, Math.min(1, H)));
  }
}

/**
 * fBM 1D (Íñigo Quílez, "fbm"): octavas de value noise con ganancia G = 2^-H.
 * H=1 → "yellow noise", deriva con memoria (montañas). H=0 → pink, nervio puro.
 * Frecuencias ligeramente destempladas (2.01) para que picos y ceros no coincidan.
 */
export function fbm(x: number, H: number, octavas = 4): number {
  const G = 2 ** -H;
  let f = 1, a = 1, suma = 0, norma = 0;
  for (let i = 0; i < octavas; i++) {
    suma += a * valueNoise(x * f + i * 13.7); // offset por octava: decorrelación
    norma += a;
    f *= 2.01;
    a *= G;
  }
  return suma / norma; // normalizado a [-1, 1]
}

function valueNoise(x: number): number {
  const i = Math.floor(x), p = x - i;
  const t = p * p * (3 - 2 * p); // smoothstep
  const a = azar(i), b = azar(i + 1);
  return a + (b - a) * t;
}

function azar(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}
