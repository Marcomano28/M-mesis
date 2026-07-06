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

      const v = l.activo ? onda(l.forma, tiempo * l.frecuencia + l.fase) * l.amplitud : 0;
      this.bus.modular(l.destino, l.id, v);
    }
  }
}

/** Formas de onda normalizadas a [-1, 1]. `x` en ciclos (1.0 = un periodo). */
export function onda(forma: FormaLFO, x: number): number {
  const p = x - Math.floor(x);
  switch (forma) {
    case 'seno':      return Math.sin(2 * Math.PI * x);
    case 'triangulo': return 1 - 4 * Math.abs(p - 0.5);
    case 'sierra':    return 2 * p - 1;
    case 'cuadrada':  return p < 0.5 ? 1 : -1;
    case 'ruido': {
      // Value noise suave: valores pseudoaleatorios por ciclo, interpolados
      const i = Math.floor(x);
      const a = azar(i), b = azar(i + 1);
      const t = p * p * (3 - 2 * p); // smoothstep
      return a + (b - a) * t;
    }
  }
}

function azar(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}
